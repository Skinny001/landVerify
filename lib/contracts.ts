import { ethers } from 'ethers'

export const REGISTRY_ADDRESS =
  process.env.NEXT_PUBLIC_REGISTRY_ADDRESS || '0x550Bdc072d03d70E0111dc2567b10FcAE3f1eda0'

export const USDT_ADDRESS =
  process.env.NEXT_PUBLIC_USDT_ADDRESS || '0x75edC9335175Fc0552D51D48439F229c10420fe3'

export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.bohr.life'

export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 968)
export const CHAIN_HEX = '0x' + CHAIN_ID.toString(16)

export const BOT_CHAIN_CONFIG = {
  chainId: CHAIN_HEX,
  chainName: 'BOT Chain',
  rpcUrls: [RPC_URL],
  nativeCurrency: {
    name: 'BOT',
    symbol: 'BOT',
    decimals: 18,
  },
  blockExplorerUrls: ['https://scan.bohr.life'],
}

export const LAND_STATUS_MAP = ['Registered', 'Disputed', 'Frozen'] as const
export type LandStatusText = (typeof LAND_STATUS_MAP)[number]

export const DISPUTE_STATUS_MAP = ['Open', 'Upheld', 'Rejected'] as const
export type DisputeStatusText = (typeof DISPUTE_STATUS_MAP)[number]

export interface OnChainLandRecord {
  id: number
  plotId: string
  docHash: string
  owner: string
  registrar: string
  description: string
  geoCell: string
  registeredAt: number
  status: LandStatusText
  openDisputes: number
}

export interface OnChainDispute {
  id: number
  landId: number
  claimant: string
  evidenceHash: string
  note: string
  bond: bigint
  raisedAt: number
  status: DisputeStatusText
}

export interface OnChainTransfer {
  from: string
  to: string
  at: number
  newDocHash: string
}

export interface OnChainPendingTransfer {
  to: string
  newDocHash: string
  pending: boolean
}

export const LAND_REGISTRY_ABI = [
  'function owner() external view returns (address)',
  'function treasury() external view returns (address)',
  'function usdt() external view returns (address)',
  'function disputeBond() external view returns (uint256)',
  'function nextLandId() external view returns (uint256)',
  'function nextDisputeId() external view returns (uint256)',
  'function isRegistrar(address) external view returns (bool)',
  'function pendingTransfer(uint256) external view returns (address to, bytes32 newDocHash, bool pending)',
  'function lands(uint256) external view returns (uint256 id, string plotId, bytes32 docHash, address owner, address registrar, string description, string geoCell, uint64 registeredAt, uint8 status, uint32 openDisputes)',
  'function getLand(uint256 id) external view returns (tuple(uint256 id, string plotId, bytes32 docHash, address owner, address registrar, string description, string geoCell, uint64 registeredAt, uint8 status, uint32 openDisputes))',
  'function getDisputes(uint256 id) external view returns (tuple(uint256 id, uint256 landId, address claimant, bytes32 evidenceHash, string note, uint256 bond, uint64 raisedAt, uint8 status)[])',
  'function getHistory(uint256 id) external view returns (tuple(address from, address to, uint64 at, bytes32 newDocHash)[])',
  'function verify(bytes32 docHash) external view returns (bool found, uint256 landId, uint8 status, address owner_, address registrar, uint64 registeredAt, uint32 openDisputes)',
  'function getByPlotId(string calldata plotId) external view returns (bool found, uint256 landId, uint8 status, address owner_, address registrar, uint64 registeredAt, uint32 openDisputes)',
  'function registerLand(string calldata plotId, bytes32 docHash, address owner_, string calldata description, string calldata geoCell) external returns (uint256)',
  'function raiseDispute(uint256 landId, bytes32 evidenceHash, string calldata note) external',
  'function resolveDispute(uint256 landId, uint256 index, bool upheld) external',
  'function unfreeze(uint256 landId) external',
  'function requestTransfer(uint256 landId, address to, bytes32 newDocHash) external',
  'function approveTransfer(uint256 landId) external',
  'function cancelTransfer(uint256 landId) external',
  'function addRegistrar(address account) external',
  'function removeRegistrar(address account) external',
  'function setDisputeBond(uint256 amount) external',
  'function setTreasury(address account) external',
  'event LandRegistered(uint256 indexed id, string plotId, bytes32 docHash, address indexed owner)',
  'event DisputeRaised(uint256 indexed landId, uint256 indexed disputeId, address indexed claimant)',
  'event DisputeResolved(uint256 indexed landId, uint256 indexed disputeId, bool upheld)',
  'event LandFrozen(uint256 indexed landId)',
  'event LandUnfrozen(uint256 indexed landId)',
  'event TransferRequested(uint256 indexed landId, address indexed to)',
  'event TransferApproved(uint256 indexed landId, address indexed from, address indexed to)',
  'event RegistrarAdded(address indexed registrar)',
  'event RegistrarRemoved(address indexed registrar)',
]

export const USDT_ABI = [
  'function name() external view returns (string)',
  'function symbol() external view returns (string)',
  'function decimals() external view returns (uint8)',
  'function balanceOf(address owner) external view returns (uint256)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function approve(address spender, uint256 value) external returns (bool)',
  'function transfer(address to, uint256 value) external returns (bool)',
  'function transferFrom(address from, address to, uint256 value) external returns (bool)',
]

export function getReadProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(RPC_URL)
}

export function getRegistryContract(
  signerOrProvider: ethers.Signer | ethers.Provider = getReadProvider()
): ethers.Contract {
  return new ethers.Contract(REGISTRY_ADDRESS, LAND_REGISTRY_ABI, signerOrProvider)
}

export function getUsdtContract(
  signerOrProvider: ethers.Signer | ethers.Provider = getReadProvider()
): ethers.Contract {
  return new ethers.Contract(USDT_ADDRESS, USDT_ABI, signerOrProvider)
}

let cachedDecimals: number | null = null

export async function getUsdtDecimals(
  signerOrProvider: ethers.Signer | ethers.Provider = getReadProvider()
): Promise<number> {
  if (cachedDecimals !== null) return cachedDecimals
  try {
    const usdt = getUsdtContract(signerOrProvider)
    const dec = await usdt.decimals()
    cachedDecimals = Number(dec)
    return cachedDecimals
  } catch (err) {
    console.warn('Failed to read decimals() from USDT token, falling back to 6:', err)
    return 6
  }
}


export function formatAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr || ''
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function formatTimestamp(ts: number): string {
  if (!ts) return '—'
  const date = new Date(ts * 1000)
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function parseContractError(err: any): string {
  if (!err) return 'Unknown error occurred.'
  if (err.reason) return err.reason
  if (err.shortMessage) return err.shortMessage
  if (err.data && typeof err.data === 'string') return err.data
  if (err.message) {
    if (err.message.includes('user rejected action')) return 'Transaction was rejected by user in wallet.'
    if (err.message.includes('insufficient funds')) return 'Insufficient BOT funds for gas fees.'
    if (err.message.includes('not registrar')) return 'Only an authorized registrar can perform this action.'
    if (err.message.includes('conflict registrar')) return 'Conflict: The registrar who recorded this parcel cannot resolve its dispute.'
    if (err.message.includes('record registrar only')) return 'Only the registrar who recorded this land can approve its transfer.'
    if (err.message.includes('owner cannot dispute')) return 'Current land owner cannot dispute their own parcel.'
    if (err.message.includes('duplicate record')) return 'Duplicate record: Plot ID or document hash already registered.'
    if (err.message.includes('duplicate document')) return 'Document hash is already registered to another parcel.'
    if (err.message.includes('transfer unavailable')) return 'Transfer is currently unavailable (parcel may be Disputed or Frozen).'
    if (err.message.includes('cannot unfreeze')) return 'Cannot unfreeze parcel until all disputes are resolved.'
    return err.message.slice(0, 160)
  }
  return 'Transaction execution failed.'
}
