import { ethers } from 'ethers'
import {
  getRegistryContract,
  getUsdtContract,
  REGISTRY_ADDRESS,
  LAND_STATUS_MAP,
  DISPUTE_STATUS_MAP,
  OnChainLandRecord,
  OnChainDispute,
  OnChainTransfer,
  OnChainPendingTransfer,
  parseContractError,
  getUsdtDecimals,
} from './contracts'

export interface FullLandDetails {
  record: OnChainLandRecord
  history: OnChainTransfer[]
  disputes: OnChainDispute[]
  pendingTransfer?: OnChainPendingTransfer
}

export async function fetchAllLands(): Promise<OnChainLandRecord[]> {
  try {
    const registry = getRegistryContract()
    const nextIdBig = await registry.nextLandId()
    const totalCount = Number(nextIdBig) - 1

    if (totalCount <= 0) return []

    const records: OnChainLandRecord[] = []
    for (let id = 1; id <= totalCount; id++) {
      try {
        const raw = await registry.getLand(id)
        if (raw && raw.id > 0) {
          records.push({
            id: Number(raw.id),
            plotId: raw.plotId,
            docHash: raw.docHash,
            owner: raw.owner,
            registrar: raw.registrar,
            description: raw.description,
            geoCell: raw.geoCell,
            registeredAt: Number(raw.registeredAt),
            status: LAND_STATUS_MAP[Number(raw.status)] || 'Registered',
            openDisputes: Number(raw.openDisputes),
          })
        }
      } catch (e) {
        console.warn(`Failed to fetch land ${id}:`, e)
      }
    }
    return records
  } catch (err) {
    console.error('Error fetching all lands:', err)
    return []
  }
}

export async function fetchLandDetails(id: number): Promise<FullLandDetails | null> {
  try {
    const registry = getRegistryContract()
    const [rawLand, rawHistory, rawDisputes, rawPending] = await Promise.all([
      registry.getLand(id),
      registry.getHistory(id),
      registry.getDisputes(id),
      registry.pendingTransfer(id).catch(() => null),
    ])

    if (!rawLand || Number(rawLand.id) === 0) return null

    const record: OnChainLandRecord = {
      id: Number(rawLand.id),
      plotId: rawLand.plotId,
      docHash: rawLand.docHash,
      owner: rawLand.owner,
      registrar: rawLand.registrar,
      description: rawLand.description,
      geoCell: rawLand.geoCell,
      registeredAt: Number(rawLand.registeredAt),
      status: LAND_STATUS_MAP[Number(rawLand.status)] || 'Registered',
      openDisputes: Number(rawLand.openDisputes),
    }

    const history: OnChainTransfer[] = (rawHistory || []).map((h: any) => ({
      from: h.from,
      to: h.to,
      at: Number(h.at),
      newDocHash: h.newDocHash,
    }))

    const disputes: OnChainDispute[] = (rawDisputes || []).map((d: any) => ({
      id: Number(d.id),
      landId: Number(d.landId),
      claimant: d.claimant,
      evidenceHash: d.evidenceHash,
      note: d.note,
      bond: BigInt(d.bond),
      raisedAt: Number(d.raisedAt),
      status: DISPUTE_STATUS_MAP[Number(d.status)] || 'Open',
    }))

    let pendingTransfer: OnChainPendingTransfer | undefined = undefined
    if (rawPending && rawPending.pending) {
      pendingTransfer = {
        to: rawPending.to,
        newDocHash: rawPending.newDocHash,
        pending: rawPending.pending,
      }
    }

    return { record, history, disputes, pendingTransfer }
  } catch (err) {
    console.error(`Failed to fetch details for land ${id}:`, err)
    return null
  }
}

export async function verifyByDocHash(docHash: string): Promise<{
  found: boolean
  details: FullLandDetails | null
}> {
  try {
    const registry = getRegistryContract()
    const res = await registry.verify(docHash)
    if (!res || !res.found || Number(res.landId) === 0) {
      return { found: false, details: null }
    }
    const details = await fetchLandDetails(Number(res.landId))
    return { found: true, details }
  } catch (err) {
    console.error('Verify by docHash failed:', err)
    return { found: false, details: null }
  }
}

export async function verifyByPlotId(plotId: string): Promise<{
  found: boolean
  details: FullLandDetails | null
}> {
  try {
    const registry = getRegistryContract()
    const res = await registry.getByPlotId(plotId.trim())
    if (!res || !res.found || Number(res.landId) === 0) {
      return { found: false, details: null }
    }
    const details = await fetchLandDetails(Number(res.landId))
    return { found: true, details }
  } catch (err) {
    console.error('Verify by plotId failed:', err)
    return { found: false, details: null }
  }
}

// -------------------------------------------------------------
// WRITE OPERATIONS
// -------------------------------------------------------------

export async function registerLandOnChain(
  signer: ethers.Signer,
  payload: {
    plotId: string
    docHash: string
    owner: string
    description: string
    geoCell: string
  }
): Promise<{ txHash: string; landId?: number }> {
  try {
    const registry = getRegistryContract(signer)
    const tx = await registry.registerLand(
      payload.plotId.trim(),
      payload.docHash,
      payload.owner.trim(),
      payload.description.trim(),
      payload.geoCell.trim()
    )
    const receipt = await tx.wait()

    // Find LandRegistered event
    let landId: number | undefined
    if (receipt && receipt.logs) {
      for (const log of receipt.logs) {
        try {
          const parsed = registry.interface.parseLog({
            topics: [...log.topics],
            data: log.data,
          })
          if (parsed && parsed.name === 'LandRegistered') {
            landId = Number(parsed.args.id)
            break
          }
        } catch {}
      }
    }

    return { txHash: receipt.hash, landId }
  } catch (err) {
    throw new Error(parseContractError(err))
  }
}

export async function raiseDisputeOnChain(
  signer: ethers.Signer,
  payload: {
    landId: number
    evidenceHash: string
    note: string
    onProgress?: (step: 'checking-allowance' | 'approving' | 'submitting') => void
  }
): Promise<{ txHash: string }> {
  try {
    const userAddr = await signer.getAddress()
    const registry = getRegistryContract(signer)
    const usdt = getUsdtContract(signer)

    payload.onProgress?.('checking-allowance')
    const bondRequired: bigint = await registry.disputeBond()
    const currentAllowance: bigint = await usdt.allowance(userAddr, REGISTRY_ADDRESS)

    if (currentAllowance < bondRequired) {
      payload.onProgress?.('approving')
      const approveTx = await usdt.approve(REGISTRY_ADDRESS, bondRequired)
      await approveTx.wait()
    }

    payload.onProgress?.('submitting')
    const tx = await registry.raiseDispute(
      payload.landId,
      payload.evidenceHash,
      payload.note.trim()
    )
    const receipt = await tx.wait()
    return { txHash: receipt.hash }
  } catch (err) {
    throw new Error(parseContractError(err))
  }
}

export async function resolveDisputeOnChain(
  signer: ethers.Signer,
  payload: {
    landId: number
    disputeIndex: number
    upheld: boolean
  }
): Promise<{ txHash: string }> {
  try {
    const registry = getRegistryContract(signer)
    const tx = await registry.resolveDispute(
      payload.landId,
      payload.disputeIndex,
      payload.upheld
    )
    const receipt = await tx.wait()
    return { txHash: receipt.hash }
  } catch (err) {
    throw new Error(parseContractError(err))
  }
}

export async function unfreezeOnChain(
  signer: ethers.Signer,
  landId: number
): Promise<{ txHash: string }> {
  try {
    const registry = getRegistryContract(signer)
    const tx = await registry.unfreeze(landId)
    const receipt = await tx.wait()
    return { txHash: receipt.hash }
  } catch (err) {
    throw new Error(parseContractError(err))
  }
}

export async function requestTransferOnChain(
  signer: ethers.Signer,
  payload: {
    landId: number
    to: string
    newDocHash?: string
  }
): Promise<{ txHash: string }> {
  try {
    const registry = getRegistryContract(signer)
    const docHashBytes = payload.newDocHash && payload.newDocHash.startsWith('0x')
      ? payload.newDocHash
      : ethers.ZeroHash

    const tx = await registry.requestTransfer(
      payload.landId,
      payload.to.trim(),
      docHashBytes
    )
    const receipt = await tx.wait()
    return { txHash: receipt.hash }
  } catch (err) {
    throw new Error(parseContractError(err))
  }
}

export async function approveTransferOnChain(
  signer: ethers.Signer,
  landId: number
): Promise<{ txHash: string }> {
  try {
    const registry = getRegistryContract(signer)
    const tx = await registry.approveTransfer(landId)
    const receipt = await tx.wait()
    return { txHash: receipt.hash }
  } catch (err) {
    throw new Error(parseContractError(err))
  }
}

export async function cancelTransferOnChain(
  signer: ethers.Signer,
  landId: number
): Promise<{ txHash: string }> {
  try {
    const registry = getRegistryContract(signer)
    const tx = await registry.cancelTransfer(landId)
    const receipt = await tx.wait()
    return { txHash: receipt.hash }
  } catch (err) {
    throw new Error(parseContractError(err))
  }
}

export async function addRegistrarOnChain(
  signer: ethers.Signer,
  account: string
): Promise<{ txHash: string }> {
  try {
    const registry = getRegistryContract(signer)
    const tx = await registry.addRegistrar(account.trim())
    const receipt = await tx.wait()
    return { txHash: receipt.hash }
  } catch (err) {
    throw new Error(parseContractError(err))
  }
}

export async function removeRegistrarOnChain(
  signer: ethers.Signer,
  account: string
): Promise<{ txHash: string }> {
  try {
    const registry = getRegistryContract(signer)
    const tx = await registry.removeRegistrar(account.trim())
    const receipt = await tx.wait()
    return { txHash: receipt.hash }
  } catch (err) {
    throw new Error(parseContractError(err))
  }
}

export async function getDisputeBondAmount(): Promise<{ raw: bigint; formatted: string }> {
  try {
    const registry = getRegistryContract()
    const [bondRaw, decimals] = await Promise.all([
      registry.disputeBond() as Promise<bigint>,
      getUsdtDecimals(),
    ])
    return {
      raw: bondRaw,
      formatted: ethers.formatUnits(bondRaw, decimals),
    }
  } catch (err) {
    console.warn('Failed to fetch dispute bond:', err)
    return { raw: BigInt(10_000_000), formatted: '10' }
  }
}

export async function setDisputeBondOnChain(
  signer: ethers.Signer,
  bondAmountUsdt: number
): Promise<{ txHash: string }> {
  try {
    const registry = getRegistryContract(signer)
    const decimals = await getUsdtDecimals(signer)
    const amountUnits = ethers.parseUnits(bondAmountUsdt.toString(), decimals)
    const tx = await registry.setDisputeBond(amountUnits)
    const receipt = await tx.wait()
    return { txHash: receipt.hash }
  } catch (err) {
    throw new Error(parseContractError(err))
  }
}

export async function setTreasuryOnChain(
  signer: ethers.Signer,
  treasury: string
): Promise<{ txHash: string }> {
  try {
    const registry = getRegistryContract(signer)
    const tx = await registry.setTreasury(treasury.trim())
    const receipt = await tx.wait()
    return { txHash: receipt.hash }
  } catch (err) {
    throw new Error(parseContractError(err))
  }
}
