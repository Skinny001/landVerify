'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { keccak256, isAddress } from 'ethers'
import {
  ShieldCheck,
  Upload,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Menu,
  X,
  FilePlus2,
  Scale,
  UserRound,
  Settings,
  ExternalLink,
  Clock3,
  ChevronRight,
  Home,
  MapPin,
  FileText,
  CalendarDays,
  Search,
  Wallet,
  RefreshCw,
  Lock,
  Unlock,
  AlertTriangle,
  ArrowLeftRight,
  Layers,
  FileSearch,
  ShieldAlert,
  Coins,
  History,
  Building2,
  Check,
} from 'lucide-react'
import { useWallet } from '@/lib/useWallet'
import {
  REGISTRY_ADDRESS,
  USDT_ADDRESS,
  CHAIN_ID,
  formatAddress,
  formatTimestamp,
  OnChainLandRecord,
  OnChainDispute,
  OnChainTransfer,
} from '@/lib/contracts'
import {
  fetchAllLands,
  fetchLandDetails,
  verifyByDocHash,
  verifyByPlotId,
  registerLandOnChain,
  raiseDisputeOnChain,
  resolveDisputeOnChain,
  unfreezeOnChain,
  requestTransferOnChain,
  approveTransferOnChain,
  cancelTransferOnChain,
  addRegistrarOnChain,
  removeRegistrarOnChain,
  setDisputeBondOnChain,
  setTreasuryOnChain,
  FullLandDetails,
} from '@/lib/registryService'

type View = 'Home' | 'Verify' | 'Registrar' | 'Disputes' | 'Owner' | 'Admin'
const navItems: View[] = ['Home', 'Verify', 'Registrar', 'Disputes', 'Owner', 'Admin']

function StatusBadge({
  tone = 'green',
  children,
}: {
  tone?: 'green' | 'amber' | 'red' | 'gray'
  children: React.ReactNode
}) {
  const toneClass =
    {
      green: 'status-green',
      amber: 'status-amber',
      red: 'status-red',
      gray: 'status-gray',
    }[tone] || 'status-green'
  return (
    <span className={`status ${toneClass}`}>
      <span className="status-dot" />
      {children}
    </span>
  )
}

export default function Page() {
  const wallet = useWallet()
  const [view, setView] = useState<View>('Home')
  const [mobileOpen, setMobileOpen] = useState(false)

  // On-chain records cache
  const [records, setRecords] = useState<OnChainLandRecord[]>([])
  const [loadingRecords, setLoadingRecords] = useState(false)
  const [selectedLand, setSelectedLand] = useState<FullLandDetails | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Verify form states
  const [verifyTab, setVerifyTab] = useState<'hash' | 'plot'>('hash')
  const [fileName, setFileName] = useState('')
  const [docHashInput, setDocHashInput] = useState('')
  const [plotSearchInput, setPlotSearchInput] = useState('')
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [verifyResult, setVerifyResult] = useState<{
    searched: boolean
    found: boolean
    details: FullLandDetails | null
    query: string
  } | null>(null)

  // Registrar register form
  const [regPlotId, setRegPlotId] = useState('')
  const [regDocHash, setRegDocHash] = useState('')
  const [regOwner, setRegOwner] = useState('')
  const [regDesc, setRegDesc] = useState('')
  const [regGeo, setRegGeo] = useState('')
  const [regFileName, setRegFileName] = useState('')

  // Dispute form
  const [dispLandId, setDispLandId] = useState<number | ''>('')
  const [dispEvidenceHash, setDispEvidenceHash] = useState('')
  const [dispEvidenceFileName, setDispEvidenceFileName] = useState('')
  const [dispNote, setDispNote] = useState('')

  // Transfer form
  const [transferLandId, setTransferLandId] = useState<number | ''>('')
  const [transferTo, setTransferTo] = useState('')
  const [transferNewDocHash, setTransferNewDocHash] = useState('')

  // Admin form
  const [adminRegistrarInput, setAdminRegistrarInput] = useState('')
  const [adminBondInput, setAdminBondInput] = useState('10')
  const [adminTreasuryInput, setAdminTreasuryInput] = useState('')

  // Transaction feedback banner
  const [txStatus, setTxStatus] = useState<{
    state: 'idle' | 'pending' | 'success' | 'error'
    message: string
    txHash?: string
  }>({ state: 'idle', message: '' })

  const loadAllLands = useCallback(async () => {
    setLoadingRecords(true)
    try {
      const all = await fetchAllLands()
      setRecords(all)
    } finally {
      setLoadingRecords(false)
    }
  }, [])

  useEffect(() => {
    loadAllLands()
  }, [loadAllLands])

  // Hash dropped verification document
  async function handleVerifyFile(file?: File) {
    if (!file) return
    setFileName(file.name)
    setVerifyLoading(true)
    setVerifyResult(null)
    try {
      const buffer = await file.arrayBuffer()
      const computed = keccak256(new Uint8Array(buffer))
      setDocHashInput(computed)
      const res = await verifyByDocHash(computed)
      setVerifyResult({
        searched: true,
        found: res.found,
        details: res.details,
        query: computed,
      })
    } catch (err: any) {
      console.error(err)
    } finally {
      setVerifyLoading(false)
    }
  }

  // Verify plot search
  async function handleVerifyPlot(e: React.FormEvent) {
    e.preventDefault()
    if (!plotSearchInput.trim()) return
    setVerifyLoading(true)
    setVerifyResult(null)
    try {
      const res = await verifyByPlotId(plotSearchInput.trim())
      setVerifyResult({
        searched: true,
        found: res.found,
        details: res.details,
        query: plotSearchInput.trim(),
      })
    } catch (err: any) {
      console.error(err)
    } finally {
      setVerifyLoading(false)
    }
  }

  // 1-Click Demo Document Test
  async function handleRunDemoTest(hash: string, docName: string) {
    setVerifyTab('hash')
    setFileName(docName)
    setDocHashInput(hash)
    setVerifyLoading(true)
    setVerifyResult(null)
    try {
      const res = await verifyByDocHash(hash)
      setVerifyResult({
        searched: true,
        found: res.found,
        details: res.details,
        query: hash,
      })
    } catch (err: any) {
      console.error('Demo test failed:', err)
    } finally {
      setVerifyLoading(false)
    }
  }

  // Load parcel details
  async function openLandDetail(id: number) {
    setLoadingDetail(true)
    try {
      const details = await fetchLandDetails(id)
      setSelectedLand(details)
    } finally {
      setLoadingDetail(false)
    }
  }

  // Handle register land file
  async function handleRegisterFile(file?: File) {
    if (!file) return
    setRegFileName(file.name)
    const buffer = await file.arrayBuffer()
    const computed = keccak256(new Uint8Array(buffer))
    setRegDocHash(computed)
  }

  // Handle dispute evidence file
  async function handleEvidenceFile(file?: File) {
    if (!file) return
    setDispEvidenceFileName(file.name)
    const buffer = await file.arrayBuffer()
    const computed = keccak256(new Uint8Array(buffer))
    setDispEvidenceHash(computed)
  }

  // Submit Land Registration
  async function submitRegisterLand(e: React.FormEvent) {
    e.preventDefault()
    if (!wallet.account) {
      await wallet.connect()
      return
    }
    const signer = await wallet.getSigner()
    if (!signer) return

    setTxStatus({ state: 'pending', message: 'Publishing land parcel to BOT Chain...' })
    try {
      const res = await registerLandOnChain(signer, {
        plotId: regPlotId,
        docHash: regDocHash,
        owner: regOwner,
        description: regDesc,
        geoCell: regGeo || '0.000, 0.000',
      })
      setTxStatus({
        state: 'success',
        message: `Land registered successfully on-chain! Land ID: #${res.landId || ''}`,
        txHash: res.txHash,
      })
      setRegPlotId('')
      setRegDocHash('')
      setRegOwner('')
      setRegDesc('')
      setRegGeo('')
      setRegFileName('')
      await loadAllLands()
    } catch (err: any) {
      setTxStatus({ state: 'error', message: err.message || 'Registration failed' })
    }
  }

  // Submit Raise Dispute
  async function submitRaiseDispute(e: React.FormEvent) {
    e.preventDefault()
    if (!wallet.account) {
      await wallet.connect()
      return
    }
    const signer = await wallet.getSigner()
    if (!signer || typeof dispLandId !== 'number') return

    setTxStatus({ state: 'pending', message: 'Approving 10 USDT dispute bond...' })
    try {
      const res = await raiseDisputeOnChain(signer, {
        landId: dispLandId,
        evidenceHash: dispEvidenceHash,
        note: dispNote,
        onProgress: (step) => {
          if (step === 'approving') {
            setTxStatus({ state: 'pending', message: 'Step 1/2: Approving USDT bond...' })
          } else if (step === 'submitting') {
            setTxStatus({ state: 'pending', message: 'Step 2/2: Submitting on-chain dispute...' })
          }
        },
      })
      setTxStatus({
        state: 'success',
        message: `Dispute raised on-chain! Land #${dispLandId} marked Disputed.`,
        txHash: res.txHash,
      })
      setDispNote('')
      setDispEvidenceHash('')
      setDispEvidenceFileName('')
      await loadAllLands()
      await wallet.refreshBalances()
      if (selectedLand && selectedLand.record.id === dispLandId) {
        await openLandDetail(dispLandId)
      }
    } catch (err: any) {
      setTxStatus({ state: 'error', message: err.message || 'Dispute submission failed' })
    }
  }

  // Resolve Dispute
  async function handleResolveDispute(landId: number, index: number, upheld: boolean) {
    const signer = await wallet.getSigner()
    if (!signer) return
    setTxStatus({
      state: 'pending',
      message: `${upheld ? 'Upholding' : 'Rejecting'} dispute on-chain...`,
    })
    try {
      const res = await resolveDisputeOnChain(signer, { landId, disputeIndex: index, upheld })
      setTxStatus({
        state: 'success',
        message: `Dispute ${upheld ? 'upheld (Land Frozen)' : 'rejected (Bond forfeited)'}!`,
        txHash: res.txHash,
      })
      await loadAllLands()
      await openLandDetail(landId)
    } catch (err: any) {
      setTxStatus({ state: 'error', message: err.message })
    }
  }

  // Unfreeze
  async function handleUnfreeze(landId: number) {
    const signer = await wallet.getSigner()
    if (!signer) return
    setTxStatus({ state: 'pending', message: 'Unfreezing parcel on-chain...' })
    try {
      const res = await unfreezeOnChain(signer, landId)
      setTxStatus({
        state: 'success',
        message: 'Parcel unfrozen and returned to Registered status.',
        txHash: res.txHash,
      })
      await loadAllLands()
      await openLandDetail(landId)
    } catch (err: any) {
      setTxStatus({ state: 'error', message: err.message })
    }
  }

  // Request Transfer
  async function submitRequestTransfer(e: React.FormEvent) {
    e.preventDefault()
    const signer = await wallet.getSigner()
    if (!signer || typeof transferLandId !== 'number') return
    setTxStatus({ state: 'pending', message: 'Submitting transfer request on-chain...' })
    try {
      const res = await requestTransferOnChain(signer, {
        landId: transferLandId,
        to: transferTo,
        newDocHash: transferNewDocHash,
      })
      setTxStatus({
        state: 'success',
        message: 'Transfer requested! Awaiting registrar approval.',
        txHash: res.txHash,
      })
      setTransferTo('')
      setTransferNewDocHash('')
      await loadAllLands()
      await openLandDetail(transferLandId)
    } catch (err: any) {
      setTxStatus({ state: 'error', message: err.message })
    }
  }

  // Approve Transfer
  async function handleApproveTransfer(landId: number) {
    const signer = await wallet.getSigner()
    if (!signer) return
    setTxStatus({ state: 'pending', message: 'Approving title transfer on-chain...' })
    try {
      const res = await approveTransferOnChain(signer, landId)
      setTxStatus({
        state: 'success',
        message: 'Transfer approved! Ownership has been updated on-chain.',
        txHash: res.txHash,
      })
      await loadAllLands()
      await openLandDetail(landId)
    } catch (err: any) {
      setTxStatus({ state: 'error', message: err.message })
    }
  }

  // Cancel Transfer
  async function handleCancelTransfer(landId: number) {
    const signer = await wallet.getSigner()
    if (!signer) return
    setTxStatus({ state: 'pending', message: 'Cancelling transfer request...' })
    try {
      const res = await cancelTransferOnChain(signer, landId)
      setTxStatus({ state: 'success', message: 'Transfer request cancelled.', txHash: res.txHash })
      await loadAllLands()
      await openLandDetail(landId)
    } catch (err: any) {
      setTxStatus({ state: 'error', message: err.message })
    }
  }

  // Admin add registrar
  async function handleAddRegistrar(e: React.FormEvent) {
    e.preventDefault()
    const signer = await wallet.getSigner()
    if (!signer || !isAddress(adminRegistrarInput)) return
    setTxStatus({ state: 'pending', message: 'Authorizing registrar on-chain...' })
    try {
      const res = await addRegistrarOnChain(signer, adminRegistrarInput)
      setTxStatus({ state: 'success', message: 'Registrar authorized successfully.', txHash: res.txHash })
      setAdminRegistrarInput('')
    } catch (err: any) {
      setTxStatus({ state: 'error', message: err.message })
    }
  }

  // Admin set dispute bond
  async function handleSetDisputeBond(e: React.FormEvent) {
    e.preventDefault()
    const signer = await wallet.getSigner()
    if (!signer) return
    setTxStatus({ state: 'pending', message: 'Updating dispute bond on-chain...' })
    try {
      const res = await setDisputeBondOnChain(signer, Number(adminBondInput))
      setTxStatus({ state: 'success', message: 'Dispute bond updated.', txHash: res.txHash })
    } catch (err: any) {
      setTxStatus({ state: 'error', message: err.message })
    }
  }

  // Admin set treasury
  async function handleSetTreasury(e: React.FormEvent) {
    e.preventDefault()
    const signer = await wallet.getSigner()
    if (!signer || !isAddress(adminTreasuryInput)) return
    setTxStatus({ state: 'pending', message: 'Updating treasury on-chain...' })
    try {
      const res = await setTreasuryOnChain(signer, adminTreasuryInput)
      setTxStatus({ state: 'success', message: 'Treasury address updated.', txHash: res.txHash })
      setAdminTreasuryInput('')
    } catch (err: any) {
      setTxStatus({ state: 'error', message: err.message })
    }
  }

  const goHome = () => {
    setView('Home')
    setSelectedLand(null)
    setMobileOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <main>
      {/* Network Warning Bar if wallet connected to wrong chain */}
      {wallet.account && !wallet.isCorrectNetwork && (
        <div className="network-warning-bar">
          <span>
            <AlertTriangle size={15} style={{ display: 'inline', marginRight: 6 }} />
            Connected to Chain ID #{wallet.chainId}. LandVerify requires BOT Chain (ID: {CHAIN_ID}).
          </span>
          <button type="button" onClick={() => wallet.switchToBotChain()}>
            Switch to BOT Chain
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className="nav">
        <button type="button" className="brand" onClick={goHome} style={{ display: 'inline-flex', alignItems: 'center' }}>
          <img
            src="/logo.png"
            alt="LandVerify Logo"
            style={{
              width: 34,
              height: 34,
              borderRadius: 6,
              marginRight: 10,
              verticalAlign: 'middle',
              objectFit: 'cover',
              boxShadow: '0 2px 8px rgba(25,111,74,0.2)',
            }}
          />
          LAND<span>VERIFY</span>
        </button>

        <div className={`nav-links ${mobileOpen ? 'open' : ''}`}>
          {navItems.map((item) => (
            <button
              key={item}
              type="button"
              className={view === item ? 'active' : ''}
              onClick={() => {
                setView(item)
                setSelectedLand(null)
                setMobileOpen(false)
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
            >
              {item}
            </button>
          ))}

          {/* Wallet Button */}
          {wallet.account ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {wallet.isRegistrar && <span className="badge badge-registrar">Registrar</span>}
              {wallet.isContractOwner && <span className="badge badge-admin">Admin</span>}
              <button
                type="button"
                className="wallet-button"
                onClick={() => setView('Owner')}
                title={`Connected: ${wallet.account}`}
              >
                <Wallet size={14} />
                {formatAddress(wallet.account)}
                <span className="wallet-dot" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="wallet-button"
              onClick={wallet.connect}
              disabled={wallet.isConnecting}
            >
              <Wallet size={14} />
              {wallet.isConnecting ? 'Connecting...' : 'Connect wallet'}
              <span className="wallet-dot" />
            </button>
          )}
        </div>

        <button
          type="button"
          className="mobile-menu"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X /> : <Menu />}
        </button>
      </nav>

      {/* Global Tx Banner */}
      {txStatus.state !== 'idle' && (
        <div style={{ maxWidth: 1100, margin: '14px auto 0', padding: '0 24px' }}>
          <div
            className={`banner banner-${txStatus.state}`}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <div>
              {txStatus.state === 'pending' && <span className="spinner" style={{ marginRight: 8 }} />}
              {txStatus.state === 'success' && <CheckCircle2 size={16} style={{ display: 'inline', marginRight: 6 }} />}
              {txStatus.state === 'error' && <AlertCircle size={16} style={{ display: 'inline', marginRight: 6 }} />}
              <strong>{txStatus.message}</strong>
              {txStatus.txHash && (
                <a
                  href={`https://scan.bohr.life/tx/${txStatus.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View on Explorer <ExternalLink size={12} style={{ display: 'inline' }} />
                </a>
              )}
            </div>
            <button
              type="button"
              onClick={() => setTxStatus({ state: 'idle', message: '' })}
              style={{ background: 'none', border: 0, cursor: 'pointer', color: 'inherit' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 1. HOME VIEW: PROJECT EXPLANATION & ARCHITECTURE */}
      {/* ============================================================ */}
      {view === 'Home' && (
        <>
          {/* Hero Section */}
          <div id="top" className="hero">
            <div className="hero-grid" />
            <div className="hero-content">
              <div className="eyebrow">
                <span className="eyebrow-line" /> Tamper-Evident Title Registry
              </div>
              <h1>
                Stopping Land Fraud
                <br />
                <em>Before Money Moves.</em>
              </h1>
              <p className="hero-lead">
                LandVerify is a decentralized protocol built on <strong>BOT Chain</strong> that
                anchors mathematical document fingerprints (Certificates of Occupancy, Survey Plans,
                and Deeds) onto an immutable ledger. Buyers, banks, and legal advisors can verify real
                estate title legitimacy in seconds before making irreversible payments.
              </p>
              <div className="hero-actions">
                <button
                  type="button"
                  onClick={() => {
                    setView('Verify')
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  className="primary-button"
                >
                  Launch Verification Station <ArrowRight size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })
                  }}
                  className="text-button"
                >
                  How it works <span>&darr;</span>
                </button>
              </div>

              <div className="trust-row">
                <div>
                  <strong>{records.length}</strong>
                  <span>Parcels on-chain</span>
                </div>
                <div>
                  <strong>BOT Chain</strong>
                  <span>Chain ID: {CHAIN_ID}</span>
                </div>
                <div>
                  <strong>10 USDT</strong>
                  <span>Bonded dispute escrow</span>
                </div>
              </div>
            </div>

            <div className="hero-aside">
              <div className="scan-orbit">
                <span className="orbit-label label-top">PUBLIC AUDIT TRAIL</span>
                <div className="orbit-ring ring-one" />
                <div className="orbit-ring ring-two" />
                <div className="orbit-core">
                  <ShieldCheck size={48} />
                </div>
                <span className="orbit-label label-bottom">IMMUTABLE ANCHOR</span>
              </div>
            </div>
          </div>

          {/* SECTION 1: THE PROBLEM */}
          <section className="home-section" style={{ background: 'var(--paper)' }}>
            <div className="section-intro">
              <div className="eyebrow">
                <span className="eyebrow-line" /> The Systemic Challenge
              </div>
              <h2>Why Real Estate Transactions Fail in Nigeria</h2>
              <p>
                Billions of naira are lost annually across Lagos, Abuja, Port Harcourt, and Ibadan due
                to paper-based opacity, counterfeit deeds, and uncoordinated registry registries.
              </p>
            </div>

            <div className="feature-cards">
              <div className="feature-card">
                <div className="card-icon-wrap" style={{ background: '#fdf2f2', color: '#ae4d46' }}>
                  <FileText size={24} />
                </div>
                <span className="feature-tag">Critical Vulnerability #1</span>
                <h3>Document Alteration & Deed Forgery</h3>
                <p>
                  Physical Certificates of Occupancy and survey plans are frequently duplicated or forged
                  with counterfeit ministry stamps. Buyers have no real-time way to verify whether the paper
                  in front of them matches official records.
                </p>
              </div>

              <div className="feature-card">
                <div className="card-icon-wrap" style={{ background: '#fef9ee', color: '#b7791f' }}>
                  <Layers size={24} />
                </div>
                <span className="feature-tag">Critical Vulnerability #2</span>
                <h3>Double-Selling & Multiple Allocations</h3>
                <p>
                  Disreputable vendors or land-grabbers sell the exact same parcel to multiple unsuspecting
                  buyers. Because paper filings take months to register, multiple buyers can pay full price
                  before the first claim is ever published.
                </p>
              </div>

              <div className="feature-card">
                <div className="card-icon-wrap" style={{ background: '#eef4ec', color: '#196f4a' }}>
                  <ShieldAlert size={24} />
                </div>
                <span className="feature-tag">Critical Vulnerability #3</span>
                <h3>Hidden Court Injunctions & Family Feuds</h3>
                <p>
                  Parcels often carry active court disputes, family conflicts, or revoked titles. Sellers
                  conceal these disputes, leaving the new buyer entangled in expensive litigations or
                  demolitions.
                </p>
              </div>
            </div>
          </section>

          {/* SECTION 2: HOW IT WORKS */}
          <section className="home-section" id="how-it-works">
            <div className="section-intro">
              <div className="eyebrow">
                <span className="eyebrow-line" /> The Protocol Design
              </div>
              <h2>How LandVerify Secures Every Title</h2>
              <p>
                Our protocol combines client-side zero-knowledge hashing with an authorized registrar
                governance layer and economic dispute staking on BOT Chain.
              </p>
            </div>

            <div className="steps-grid">
              <div className="step-card">
                <span className="step-number">01</span>
                <h3>Accredited Registrar Onboarding</h3>
                <p>
                  Only verified institutional registrars (surveyors, land bureau officers, legal authorities)
                  can register land records on-chain, eliminating frivolous spam.
                </p>
              </div>

              <div className="step-card">
                <span className="step-number">02</span>
                <h3>Zero-Knowledge Client Hashing</h3>
                <p>
                  Land deeds are never uploaded to a cloud server. Instead, the document is hashed locally
                  in the browser into a unique 32-byte cryptographic fingerprint (keccak256).
                </p>
              </div>

              <div className="step-card">
                <span className="step-number">03</span>
                <h3>Bonded Dispute Staking (10 USDT)</h3>
                <p>
                  Anyone can dispute a parcel by locking 10 USDT in escrow with cryptographic evidence. If
                  upheld, the bond is refunded and the title is Frozen. If frivolous, the bond is forfeited.
                </p>
              </div>

              <div className="step-card">
                <span className="step-number">04</span>
                <h3>Ratified Two-Step Title Transfers</h3>
                <p>
                  Owners can request a transfer on-chain, but the certifying registrar must ratify the
                  transaction to update the ledger—preventing unauthorized wallet hijackings.
                </p>
              </div>
            </div>
          </section>

          {/* SECTION 3: ARCHITECTURE ON BOT CHAIN */}
          <div className="ecosystem-banner">
            <div>
              <div className="eyebrow" style={{ color: 'var(--lime)' }}>
                <span className="eyebrow-line" style={{ background: 'var(--lime)' }} /> Infrastructure
              </div>
              <h2>Built for Institutional Trust on BOT Chain</h2>
              <p>
                BOT Chain delivers sub-second transaction finality, ultra-low gas costs, and EVM
                compatibility. Our smart contracts provide permanent auditability while preserving user
                privacy.
              </p>
              <div style={{ marginTop: 24 }}>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    setView('Verify')
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  style={{ background: 'var(--lime)', color: 'var(--ink)' }}
                >
                  Try Document Verification <ArrowRight size={16} />
                </button>
              </div>
            </div>

            <div className="eco-box">
              <div className="eco-row">
                <span>Contract Address</span>
                <strong>{formatAddress(REGISTRY_ADDRESS)}</strong>
              </div>
              <div className="eco-row">
                <span>Network</span>
                <strong>BOT Chain (968)</strong>
              </div>
              <div className="eco-row">
                <span>Dispute Escrow Token</span>
                <strong>USDT (6 Decimals)</strong>
              </div>
              <div className="eco-row">
                <span>Block Explorer</span>
                <strong style={{ color: 'white' }}>scan.bohr.life</strong>
              </div>
              <div className="eco-row" style={{ borderBottom: 0 }}>
                <span>Contract Security</span>
                <strong>ReentrancyGuard · Ownable</strong>
              </div>
            </div>
          </div>

          {/* SECTION 4: CALL TO ACTION */}
          <section className="home-cta-bar">
            <h2>Verify Before You Commit</h2>
            <p>
              Don&apos;t risk your hard-earned capital on unverified claims. Check any Nigerian land
              document against our public registry now.
            </p>
            <div style={{ display: 'flex', gap: 16 }}>
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  setView('Verify')
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
              >
                Go to Verification Station <ArrowRight size={16} />
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setView('Registrar')
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
              >
                Registrar Workspace
              </button>
            </div>
          </section>
        </>
      )}

      {/* ============================================================ */}
      {/* 2. VERIFY VIEW: DEDICATED VERIFICATION STATION */}
      {/* ============================================================ */}
      {view === 'Verify' && (
        <section className="workspace-page" style={{ paddingTop: 40 }}>
          <div className="workspace-toolbar">
            <button type="button" className="back-home" onClick={goHome}>
              <Home size={15} /> Home
            </button>
            <div className="eyebrow">
              <span className="eyebrow-line" /> LandVerify / Public Verification Station
            </div>
          </div>

          <div className="workspace-hero">
            <div>
              <h1>Public Verification Station</h1>
              <p>
                Drop a land deed, Certificate of Occupancy, or search by Plot ID. We compute its
                cryptographic hash in browser memory and query the live BOT Chain contract at{' '}
                <span className="contract-tag">{formatAddress(REGISTRY_ADDRESS)}</span>.
              </p>
            </div>
            <div className="workspace-icon">
              <FileSearch size={54} />
            </div>
          </div>

          {/* Verification Box */}
          <div style={{ maxWidth: 900, margin: '24px auto 0' }}>
            {/* Client-Side Privacy Guarantee Badge (PRD §7.2) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 18px',
                background: '#eef4ec',
                border: '1px solid #cce2ca',
                color: 'var(--green)',
                marginBottom: 20,
                fontSize: 13,
                borderRadius: 2,
              }}
            >
              <ShieldCheck size={22} style={{ flexShrink: 0 }} />
              <div>
                <strong>No file upload to any server:</strong> Your document never leaves your device. Only
                its 32-byte cryptographic fingerprint (keccak256) is computed locally in browser memory and
                checked against the live BOT Chain contract.
              </div>
            </div>

            {/* Demo Documents Quick-Test Tray (PRD §12) */}
            <div
              style={{
                background: 'white',
                border: '1px solid var(--line)',
                padding: '20px 22px',
                marginBottom: 24,
                boxShadow: '0 4px 14px rgba(17,34,29,0.04)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 14,
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileText size={18} color="var(--green)" />
                  <strong style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Live Demo Test Documents (PRD §12 Seeded Data)
                  </strong>
                </div>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                  1-Click instant on-chain verification or download PDF samples
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: 14,
                }}
              >
                {/* Plot 1 Clean */}
                <div
                  style={{
                    padding: 14,
                    border: '1px solid #cbe4c9',
                    background: '#f8fdf7',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: 13 }}>LAG-IKJ-0421</strong>
                    <StatusBadge tone="green">Clean Registered</StatusBadge>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                    1,250 sqm Commercial Plot, Ikeja Lagos C of O
                  </span>
                  <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                    <button
                      type="button"
                      className="btn-success btn-sm"
                      style={{ flex: 1 }}
                      onClick={() =>
                        handleRunDemoTest(
                          '0x5d7ba215d6bd8f73a564317e32cc870d96efa235f8dc9759657f64f1f8fd9be5',
                          'LAG-IKJ-0421-CertificateOfOccupancy.pdf'
                        )
                      }
                    >
                      1-Click Verify
                    </button>
                    <a
                      href="/samples/LAG-IKJ-0421-CertificateOfOccupancy.pdf"
                      download
                      className="btn-secondary btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      PDF <ExternalLink size={10} />
                    </a>
                  </div>
                </div>

                {/* Plot 2 Disputed */}
                <div
                  style={{
                    padding: 14,
                    border: '1px solid #f9dfaa',
                    background: '#fffcf5',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: 13 }}>ABJ-MAI-1188</strong>
                    <StatusBadge tone="amber">Active Dispute</StatusBadge>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                    800 sqm Maitama Abuja (10 USDT Bond Escrow)
                  </span>
                  <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      style={{
                        flex: 1,
                        borderColor: 'var(--amber)',
                        color: 'var(--amber)',
                        fontWeight: 800,
                      }}
                      onClick={() =>
                        handleRunDemoTest(
                          '0x00c2af95c18a8e11cddcf3a3af19b1688c1408238579c72a241bb452c2861ea6',
                          'ABJ-MAI-1188-RightOfOccupancy.pdf'
                        )
                      }
                    >
                      1-Click Verify
                    </button>
                    <a
                      href="/samples/ABJ-MAI-1188-RightOfOccupancy.pdf"
                      download
                      className="btn-secondary btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      PDF <ExternalLink size={10} />
                    </a>
                  </div>
                </div>

                {/* Plot 3 Frozen */}
                <div
                  style={{
                    padding: 14,
                    border: '1px solid #f5c4bf',
                    background: '#fff8f7',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: 13 }}>KAN-NAS-0089</strong>
                    <StatusBadge tone="red">Title Frozen</StatusBadge>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                    2,500 sqm Nassarawa Kano (Dispute Upheld)
                  </span>
                  <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                    <button
                      type="button"
                      className="btn-danger btn-sm"
                      style={{ flex: 1 }}
                      onClick={() =>
                        handleRunDemoTest(
                          '0xd767a0ec07b9052af59233f87f43a63b24e23818d3271aa6a99ead21d65f5f6e',
                          'KAN-NAS-0089-DeedOfAssignment.pdf'
                        )
                      }
                    >
                      1-Click Verify
                    </button>
                    <a
                      href="/samples/KAN-NAS-0089-DeedOfAssignment.pdf"
                      download
                      className="btn-secondary btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      PDF <ExternalLink size={10} />
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="verify-card">
              <div className="verify-tabs">
                <button
                  type="button"
                  className={verifyTab === 'hash' ? 'active' : ''}
                  onClick={() => {
                    setVerifyTab('hash')
                    setVerifyResult(null)
                  }}
                >
                  Upload & Hash Document
                </button>
                <button
                  type="button"
                  className={verifyTab === 'plot' ? 'active' : ''}
                  onClick={() => {
                    setVerifyTab('plot')
                    setVerifyResult(null)
                  }}
                >
                  Search by Registered Plot ID
                </button>
              </div>

              {verifyTab === 'hash' ? (
                <div>
                  <label className="dropzone">
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={(e) => handleVerifyFile(e.target.files?.[0])}
                    />
                    <Upload size={32} />
                    <strong>{fileName || 'Drop land document here to verify on-chain'}</strong>
                    <span>
                      {fileName
                        ? `Fingerprint: ${docHashInput}`
                        : 'or click to browse · PDF, JPG, PNG (Hashed locally in browser memory)'}
                    </span>
                  </label>

                  {/* Hash Sensitivity Warning (PRD §13) */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginTop: 10,
                      fontSize: 11,
                      color: 'var(--muted)',
                    }}
                  >
                    <AlertCircle size={14} style={{ flexShrink: 0, color: 'var(--amber)' }} />
                    <span>
                      <strong>Hash Sensitivity:</strong> Any change to a document—even re-saving,
                      annotating, or rotating a PDF—alters its cryptographic hash completely. Always verify
                      original unaltered files.
                    </span>
                  </div>

                  <div style={{ marginTop: 14 }}>
                    <div className="input-row">
                      <input
                        placeholder="Or paste 32-byte hash (0x...)"
                        value={docHashInput}
                        onChange={(e) => setDocHashInput(e.target.value)}
                      />
                      <button
                        type="button"
                        className="primary-button"
                        disabled={verifyLoading || !docHashInput.trim()}
                        onClick={async () => {
                          if (!docHashInput.trim()) return
                          setVerifyLoading(true)
                          const res = await verifyByDocHash(docHashInput.trim())
                          setVerifyResult({
                            searched: true,
                            found: res.found,
                            details: res.details,
                            query: docHashInput.trim(),
                          })
                          setVerifyLoading(false)
                        }}
                      >
                        {verifyLoading ? <span className="spinner" /> : <Search size={16} />}
                        Verify
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <form className="plot-search" onSubmit={handleVerifyPlot}>
                  <label htmlFor="plot-id">Survey plan or Plot ID registered on-chain</label>
                  <div className="input-row">
                    <input
                      id="plot-id"
                      placeholder="e.g. LAG-IKJ-0421"
                      value={plotSearchInput}
                      onChange={(e) => setPlotSearchInput(e.target.value)}
                    />
                    <button type="submit" className="primary-button" disabled={verifyLoading}>
                      {verifyLoading ? <span className="spinner" /> : <Search size={16} />}
                      Search on-chain
                    </button>
                  </div>
                </form>
              )}

              {/* Verification Results */}
              {verifyResult && verifyResult.searched && (
                <div style={{ marginTop: 24 }}>
                  {verifyResult.found && verifyResult.details ? (
                    <div className="result-card result-green">
                      <CheckCircle2 size={36} style={{ flexShrink: 0 }} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ fontSize: 16 }}>Verified On-Chain Title Record</strong>
                          <StatusBadge
                            tone={
                              verifyResult.details.record.status === 'Registered'
                                ? 'green'
                                : verifyResult.details.record.status === 'Disputed'
                                ? 'amber'
                                : 'red'
                            }
                          >
                            {verifyResult.details.record.status}
                          </StatusBadge>
                        </div>
                        <span style={{ fontSize: 13, color: 'var(--ink)' }}>
                          Plot: <strong>{verifyResult.details.record.plotId}</strong> · Registered on{' '}
                          {formatTimestamp(verifyResult.details.record.registeredAt)}
                        </span>
                        <span style={{ fontSize: 12 }}>
                          Description: {verifyResult.details.record.description}
                        </span>
                        <span style={{ fontSize: 12 }}>
                          Current Owner: <code>{verifyResult.details.record.owner}</code>
                        </span>
                        <span style={{ fontSize: 12 }}>
                          Attesting Registrar: <code>{verifyResult.details.record.registrar}</code>
                        </span>
                        <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            onClick={() => setSelectedLand(verifyResult.details)}
                          >
                            Inspect Complete Provenance & History &rarr;
                          </button>
                          <Link
                            href={`/plot/${encodeURIComponent(verifyResult.details.record.plotId)}`}
                            className="btn-secondary btn-sm"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              color: 'var(--green)',
                              fontWeight: 700,
                            }}
                          >
                            Shareable Verification Page (/plot/{verifyResult.details.record.plotId}){' '}
                            <ExternalLink size={12} />
                          </Link>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="result-card result-gray">
                      <AlertCircle size={36} style={{ flexShrink: 0, color: '#ae4d46' }} />
                      <div>
                        <strong style={{ fontSize: 16 }}>No Registered Record Found</strong>
                        <span style={{ fontSize: 13, marginTop: 4 }}>
                          The document fingerprint or plot ID <code>{formatAddress(verifyResult.query)}</code>{' '}
                          has not been registered on BOT Chain.
                        </span>
                        <span style={{ fontSize: 11, color: '#ae4d46', marginTop: 6 }}>
                          Caution: Do not proceed with payment until legal title has been certified by an
                          accredited land registry official.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Legal Explanatory Panel (PRD §1 & §13 Compliance) */}
            <div
              style={{
                background: '#f6f5ef',
                border: '1px solid var(--line)',
                padding: '24px 28px',
                marginTop: 24,
                fontSize: 12,
                lineHeight: 1.6,
                color: 'var(--muted)',
              }}
            >
              <strong style={{ fontSize: 13, color: 'var(--ink)', display: 'block', marginBottom: 6 }}>
                What This Verification Proves & Does Not Prove (Legal Notice)
              </strong>
              <p style={{ margin: '0 0 10px' }}>
                <strong>What it proves:</strong> This system mathematically proves that a document matching the computed
                keccak256 hash was attested by an accredited registrar at a specific BOT Chain block timestamp, and
                accurately displays any active or resolved dispute bonds held in escrow.
              </p>
              <p style={{ margin: '0 0 10px' }}>
                <strong>What it does not prove:</strong> Blockchain verification does NOT constitute legal title. Sovereign
                legal ownership remains vested under statutory land registries and competent courts of law. LandVerify
                serves as a tamper-evident audit layer to eliminate double-selling and forged deeds.
              </p>
              <p style={{ margin: 0 }}>
                <strong>Garbage-in, garbage-out:</strong> If an accredited registrar records a forged instrument, the chain
                records it faithfully. However, registrar wallet identities are permanent, public, and auditable on-chain,
                making administrative misconduct fully traceable and punishable.
              </p>
            </div>

            {/* Live Parcels Table */}
            <div style={{ marginTop: 50 }}>
              <div className="section-heading">
                <div>
                  <span className="section-kicker">Live On-Chain Ledger</span>
                  <h2 style={{ fontSize: 28 }}>All Registered Parcels ({records.length})</h2>
                </div>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={loadAllLands}
                  disabled={loadingRecords}
                >
                  <RefreshCw
                    size={12}
                    className={loadingRecords ? 'spinner' : ''}
                    style={{ display: 'inline', marginRight: 5 }}
                  />
                  Refresh Ledger
                </button>
              </div>

              <div className="registry-table">
                <div className="table-head">
                  <div>Plot ID & Description</div>
                  <div>Owner</div>
                  <div>Status</div>
                  <div>Registered Date</div>
                  <div>Action</div>
                </div>

                {records.length === 0 ? (
                  <div style={{ padding: '36px 15px', textAlign: 'center', color: 'var(--muted)' }}>
                    {loadingRecords ? (
                      <div>
                        <span className="spinner" style={{ marginRight: 8 }} />
                        Querying BOT Chain contracts...
                      </div>
                    ) : (
                      <div>No parcels registered yet. Authorize a registrar to record the first title!</div>
                    )}
                  </div>
                ) : (
                  records.map((rec) => (
                    <div key={rec.id} className="table-row">
                      <div>
                        <strong>
                          #{rec.id} · {rec.plotId}
                        </strong>
                        <span>{rec.description}</span>
                      </div>
                      <div>
                        <span className="mono">{formatAddress(rec.owner)}</span>
                      </div>
                      <div>
                        <StatusBadge
                          tone={
                            rec.status === 'Registered'
                              ? 'green'
                              : rec.status === 'Disputed'
                              ? 'amber'
                              : 'red'
                          }
                        >
                          {rec.status}
                        </StatusBadge>
                      </div>
                      <div className="muted">{formatTimestamp(rec.registeredAt)}</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          onClick={() => openLandDetail(rec.id)}
                        >
                          Inspect
                        </button>
                        <Link
                          href={`/plot/${encodeURIComponent(rec.plotId)}`}
                          className="btn-secondary btn-sm"
                          style={{ color: 'var(--green)' }}
                          title="View shareable parcel page"
                        >
                          /plot
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ============================================================ */}
      {/* 3. WORKSPACES: REGISTRAR, DISPUTES, OWNER, ADMIN */}
      {/* ============================================================ */}
      {view !== 'Home' && view !== 'Verify' && (
        <section className="workspace-page">
          <div className="workspace-toolbar">
            <button type="button" className="back-home" onClick={goHome}>
              <Home size={15} /> Home
            </button>
            <div className="eyebrow">
              <span className="eyebrow-line" /> LandVerify / {view}
            </div>
          </div>

          <div className="workspace-hero">
            <div>
              <h1>
                {view === 'Registrar' && 'Registrar workspace'}
                {view === 'Disputes' && 'Dispute center'}
                {view === 'Owner' && 'Owner portal'}
                {view === 'Admin' && 'Admin console'}
              </h1>
              <p>
                {view === 'Registrar' &&
                  'Record new land parcels, certify document fingerprints, and approve title transfers on BOT Chain.'}
                {view === 'Disputes' &&
                  'Bonded dispute resolution layer. Stake 10 USDT to challenge contested claims or resolve active cases.'}
                {view === 'Owner' &&
                  'View land parcels anchored to your connected wallet, initiate title transfer requests, and review pending deeds.'}
                {view === 'Admin' &&
                  'Protocol controls for the contract deployer. Authorize registrars and manage treasury operations.'}
              </p>
            </div>
            <div className="workspace-icon">
              {view === 'Registrar' && <FilePlus2 size={54} />}
              {view === 'Disputes' && <Scale size={54} />}
              {view === 'Owner' && <UserRound size={54} />}
              {view === 'Admin' && <Settings size={54} />}
            </div>
          </div>

          {/* Stats Bar */}
          <div className="workspace-grid">
            <div className="workspace-card">
              <span className="card-label">Contract Status</span>
              <strong>Live on BOT Chain</strong>
              <StatusBadge tone="green">Chain ID: {CHAIN_ID}</StatusBadge>
            </div>
            <div className="workspace-card">
              <span className="card-label">On-Chain Parcels</span>
              <strong>{records.length}</strong>
              <span>Publicly auditable titles</span>
            </div>
            <div className="workspace-card">
              <span className="card-label">Contract Address</span>
              <strong>{formatAddress(REGISTRY_ADDRESS)}</strong>
              <a
                href={`https://scan.bohr.life/address/${REGISTRY_ADDRESS}`}
                target="_blank"
                rel="noreferrer"
              >
                View verified on explorer <ExternalLink size={13} />
              </a>
            </div>
          </div>

          {/* Wallet check prompt */}
          {!wallet.account && (
            <div className="wallet-connect" style={{ marginTop: 28 }}>
              <Wallet size={36} />
              <h3>Connect your wallet to interact</h3>
              <p>
                Wallet connection is required to submit on-chain transactions to BOT Chain. Reading
                records is always free and public.
              </p>
              <button
                type="button"
                className="primary-button"
                onClick={wallet.connect}
                disabled={wallet.isConnecting}
              >
                {wallet.isConnecting ? 'Connecting...' : 'Connect Wallet'}
              </button>
            </div>
          )}

          {/* WORKSPACE 1: REGISTRAR */}
          {view === 'Registrar' && (
            <div style={{ marginTop: 32 }}>
              {wallet.account && !wallet.isRegistrar && (
                <div className="banner banner-error" style={{ marginBottom: 20 }}>
                  <AlertCircle size={18} />
                  <span>
                    Your connected wallet (<code>{formatAddress(wallet.account)}</code>) is not an
                    authorized registrar. Only registrars approved by the protocol admin can call{' '}
                    <code>registerLand</code>.
                  </span>
                </div>
              )}

              <form className="workflow-card" onSubmit={submitRegisterLand}>
                <div className="workflow-head">
                  <div>
                    <span className="section-kicker">Registrar Workflow</span>
                    <h2>Register New Land Parcel</h2>
                  </div>
                </div>

                <div className="form-two">
                  <label>
                    Plot ID *
                    <input
                      required
                      placeholder="e.g. LAG-IKJ-0421"
                      value={regPlotId}
                      onChange={(e) => setRegPlotId(e.target.value)}
                    />
                  </label>
                  <label>
                    Owner Address *
                    <input
                      required
                      placeholder="0x... recipient wallet"
                      value={regOwner}
                      onChange={(e) => setRegOwner(e.target.value)}
                    />
                  </label>
                </div>

                <label>
                  Document Certificate (PDF, JPG, PNG) *
                  <div className="mini-upload">
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={(e) => handleRegisterFile(e.target.files?.[0])}
                    />
                    <Upload size={18} />
                    <span>
                      {regFileName
                        ? `${regFileName} (Hash: ${formatAddress(regDocHash)})`
                        : 'Choose Certificate of Occupancy or Deed to hash'}
                    </span>
                  </div>
                </label>

                <label>
                  Document Keccak256 Hash *
                  <input
                    required
                    placeholder="0x... document fingerprint"
                    value={regDocHash}
                    onChange={(e) => setRegDocHash(e.target.value)}
                  />
                </label>

                <label>
                  Description
                  <textarea
                    required
                    placeholder="e.g. 1,250 sqm Commercial Plot, Ikeja, Lagos State"
                    value={regDesc}
                    onChange={(e) => setRegDesc(e.target.value)}
                  />
                </label>

                <label>
                  Geo Location / Coordinates / Spatial Cell
                  <input
                    placeholder="e.g. 6.5954, 3.3541"
                    value={regGeo}
                    onChange={(e) => setRegGeo(e.target.value)}
                  />
                </label>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={
                    txStatus.state === 'pending' || (wallet.account ? !wallet.isRegistrar : false)
                  }
                >
                  {txStatus.state === 'pending' ? (
                    <>
                      <span className="spinner" /> Broadcasting to BOT Chain...
                    </>
                  ) : (
                    <>
                      Publish to LandRegistry <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* WORKSPACE 2: DISPUTES */}
          {view === 'Disputes' && (
            <div style={{ marginTop: 32 }}>
              <div className="workflow-card" style={{ marginBottom: 28 }}>
                <div className="workflow-head">
                  <div>
                    <span className="section-kicker">Dispute Protection</span>
                    <h2>Raise an On-Chain Challenge</h2>
                  </div>
                  <StatusBadge tone="amber">10 USDT Bond Required</StatusBadge>
                </div>
                <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.6 }}>
                  To deter malicious or frivolous challenges, raising a dispute requires locking a 10
                  USDT bond. If your claim is upheld by an independent registrar, your bond is refunded
                  and the title is Frozen. If rejected, the bond is forfeited to the treasury.
                </p>

                <form
                  onSubmit={submitRaiseDispute}
                  style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
                >
                  <label>
                    Target Land ID *
                    <select
                      required
                      value={dispLandId}
                      onChange={(e) => setDispLandId(Number(e.target.value))}
                    >
                      <option value="">Select a registered parcel</option>
                      {records.map((r) => (
                        <option key={r.id} value={r.id}>
                          #{r.id} - {r.plotId} ({r.description}) [{r.status}]
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Evidence Document (Survey overlap, court order, etc.)
                    <div className="mini-upload">
                      <input
                        type="file"
                        onChange={(e) => handleEvidenceFile(e.target.files?.[0])}
                      />
                      <Upload size={18} />
                      <span>
                        {dispEvidenceFileName
                          ? `${dispEvidenceFileName} (Hash: ${formatAddress(dispEvidenceHash)})`
                          : 'Drop evidence document to compute hash'}
                      </span>
                    </div>
                  </label>

                  <label>
                    Evidence Hash (bytes32) *
                    <input
                      required
                      placeholder="0x... cryptographic fingerprint of evidence"
                      value={dispEvidenceHash}
                      onChange={(e) => setDispEvidenceHash(e.target.value)}
                    />
                  </label>

                  <label>
                    Dispute Reason / Claim Note *
                    <textarea
                      required
                      placeholder="Explain the boundary overlap or forged documentation claim (max 200 chars)"
                      maxLength={200}
                      value={dispNote}
                      onChange={(e) => setDispNote(e.target.value)}
                    />
                  </label>

                  <button
                    type="submit"
                    className="primary-button"
                    disabled={txStatus.state === 'pending' || typeof dispLandId !== 'number'}
                  >
                    {txStatus.state === 'pending' ? (
                      <>
                        <span className="spinner" /> Processing Bond & Dispute...
                      </>
                    ) : (
                      <>
                        Deposit 10 USDT & Raise Dispute <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* WORKSPACE 3: OWNER PORTAL */}
          {view === 'Owner' && (
            <div style={{ marginTop: 32 }}>
              {wallet.account ? (
                <>
                  <div className="workspace-lower">
                    <div>
                      <div className="section-kicker">My Properties</div>
                      <h2>Your Registered Parcels</h2>

                      {records.filter(
                        (r) => r.owner.toLowerCase() === wallet.account?.toLowerCase()
                      ).length === 0 ? (
                        <div
                          style={{
                            padding: 30,
                            background: 'var(--paper)',
                            border: '1px solid var(--line)',
                            color: 'var(--muted)',
                          }}
                        >
                          No parcels currently owned by <code>{wallet.account}</code>.
                        </div>
                      ) : (
                        <div className="record-list">
                          {records
                            .filter(
                              (r) => r.owner.toLowerCase() === wallet.account?.toLowerCase()
                            )
                            .map((record) => (
                              <button
                                type="button"
                                className="record-row"
                                key={record.id}
                                onClick={() => openLandDetail(record.id)}
                              >
                                <div>
                                  <strong>
                                    #{record.id} · {record.plotId}
                                  </strong>
                                  <span>{record.description}</span>
                                </div>
                                <StatusBadge
                                  tone={
                                    record.status === 'Registered'
                                      ? 'green'
                                      : record.status === 'Disputed'
                                      ? 'amber'
                                      : 'red'
                                  }
                                >
                                  {record.status}
                                </StatusBadge>
                                <ChevronRight size={17} />
                              </button>
                            ))}
                        </div>
                      )}
                    </div>

                    <div className="side-note">
                      <Clock3 size={20} />
                      <strong>Two-Step Ownership Transfer</strong>
                      <span>
                        Land titles cannot be transferred blindly. The owner requests the transfer,
                        and the registrar who recorded the parcel must approve it on-chain to prevent
                        coercion and unrecorded transfers.
                      </span>
                    </div>
                  </div>

                  {/* Transfer Request Form */}
                  <form
                    className="workflow-card"
                    onSubmit={submitRequestTransfer}
                    style={{ marginTop: 30 }}
                  >
                    <div className="workflow-head">
                      <div>
                        <span className="section-kicker">Title Transfer</span>
                        <h2>Initiate Ownership Transfer</h2>
                      </div>
                    </div>

                    <label>
                      Select Your Parcel *
                      <select
                        required
                        value={transferLandId}
                        onChange={(e) => setTransferLandId(Number(e.target.value))}
                      >
                        <option value="">Select parcel to transfer</option>
                        {records
                          .filter(
                            (r) => r.owner.toLowerCase() === wallet.account?.toLowerCase()
                          )
                          .map((r) => (
                            <option key={r.id} value={r.id}>
                              #{r.id} - {r.plotId} ({r.description}) [{r.status}]
                            </option>
                          ))}
                      </select>
                    </label>

                    <label>
                      Recipient / Buyer Address *
                      <input
                        required
                        placeholder="0x... buyer address"
                        value={transferTo}
                        onChange={(e) => setTransferTo(e.target.value)}
                      />
                    </label>

                    <label>
                      New Document Hash (Optional deed update)
                      <input
                        placeholder="0x... new Deed of Assignment hash (leave blank to keep current)"
                        value={transferNewDocHash}
                        onChange={(e) => setTransferNewDocHash(e.target.value)}
                      />
                    </label>

                    <button
                      type="submit"
                      className="primary-button"
                      disabled={txStatus.state === 'pending' || typeof transferLandId !== 'number'}
                    >
                      {txStatus.state === 'pending' ? (
                        <>
                          <span className="spinner" /> Submitting...
                        </>
                      ) : (
                        <>
                          Request Transfer on BOT Chain <ArrowRight size={16} />
                        </>
                      )}
                    </button>
                  </form>
                </>
              ) : (
                <div style={{ color: 'var(--muted)', textAlign: 'center', padding: 40 }}>
                  Please connect your wallet to inspect your registered land records.
                </div>
              )}
            </div>
          )}

          {/* WORKSPACE 4: ADMIN CONSOLE */}
          {view === 'Admin' && (
            <div style={{ marginTop: 32 }}>
              <div className="workflow-card" style={{ marginBottom: 28 }}>
                <div className="workflow-head">
                  <div>
                    <span className="section-kicker">Protocol Ownership</span>
                    <h2>Admin Governance</h2>
                  </div>
                  {wallet.isContractOwner ? (
                    <span className="badge badge-admin">You are Protocol Owner</span>
                  ) : (
                    <span className="badge badge-neutral">Read Only</span>
                  )}
                </div>

                <div className="detail-grid">
                  <div>
                    <span>Contract Deployer</span>
                    <strong>0x372b4eB67006F68A9f296b23715055b8A878ABA9</strong>
                  </div>
                  <div>
                    <span>USDT Contract</span>
                    <strong>{formatAddress(USDT_ADDRESS)}</strong>
                  </div>
                  <div>
                    <span>Dispute Bond</span>
                    <strong>10 USDT (10,000,000 units)</strong>
                  </div>
                  <div>
                    <span>Network</span>
                    <strong>BOT Chain (ID: 968)</strong>
                  </div>
                </div>

                {wallet.isContractOwner ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    <form onSubmit={handleAddRegistrar} style={{ display: 'flex', gap: 10 }}>
                      <input
                        required
                        placeholder="0x... address to authorize as registrar"
                        value={adminRegistrarInput}
                        onChange={(e) => setAdminRegistrarInput(e.target.value)}
                        style={{ flex: 1 }}
                      />
                      <button type="submit" className="primary-button">
                        Authorize Registrar
                      </button>
                    </form>

                    <form onSubmit={handleSetDisputeBond} style={{ display: 'flex', gap: 10 }}>
                      <input
                        required
                        type="number"
                        placeholder="Dispute Bond in USDT"
                        value={adminBondInput}
                        onChange={(e) => setAdminBondInput(e.target.value)}
                        style={{ width: 180 }}
                      />
                      <button type="submit" className="btn-secondary">
                        Update Dispute Bond
                      </button>
                    </form>

                    <form onSubmit={handleSetTreasury} style={{ display: 'flex', gap: 10 }}>
                      <input
                        required
                        placeholder="0x... new treasury address"
                        value={adminTreasuryInput}
                        onChange={(e) => setAdminTreasuryInput(e.target.value)}
                        style={{ flex: 1 }}
                      />
                      <button type="submit" className="btn-secondary">
                        Set Treasury
                      </button>
                    </form>
                  </div>
                ) : (
                  <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                    Notice: Only the owner wallet (
                    <code>0x372b...ABA9</code>) can execute registrar appointments and treasury
                    updates.
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* DETAIL MODAL / DRAWER */}
      {selectedLand && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(17,34,29,0.7)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 20,
          }}
          onClick={() => setSelectedLand(null)}
        >
          <div
            className="workflow-card"
            style={{ maxHeight: '90vh', overflowY: 'auto', width: '100%', maxWidth: 780 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="workflow-head">
              <div>
                <span className="section-kicker">BOT Chain On-Chain Record</span>
                <h2>
                  #{selectedLand.record.id} · {selectedLand.record.plotId}
                </h2>
              </div>
              <button
                type="button"
                className="close-workflow"
                onClick={() => setSelectedLand(null)}
              >
                <X />
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <StatusBadge
                tone={
                  selectedLand.record.status === 'Registered'
                    ? 'green'
                    : selectedLand.record.status === 'Disputed'
                    ? 'amber'
                    : 'red'
                }
              >
                {selectedLand.record.status}
              </StatusBadge>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                Registered on {formatTimestamp(selectedLand.record.registeredAt)}
              </span>
            </div>

            <div className="detail-grid">
              <div>
                <span>Description</span>
                <strong>{selectedLand.record.description}</strong>
              </div>
              <div>
                <span>Coordinates / Geo Cell</span>
                <strong>{selectedLand.record.geoCell}</strong>
              </div>
              <div>
                <span>Current Legal Owner</span>
                <strong>{selectedLand.record.owner}</strong>
              </div>
              <div>
                <span>Attesting Registrar</span>
                <strong>{selectedLand.record.registrar}</strong>
              </div>
            </div>

            <div className="hash-box">
              <span>Verified Document Keccak256 Fingerprint</span>
              <strong>{selectedLand.record.docHash}</strong>
            </div>

            {/* Pending Transfer Section */}
            {selectedLand.pendingTransfer && selectedLand.pendingTransfer.pending && (
              <div
                style={{
                  background: '#fff9db',
                  border: '1px solid #f59f00',
                  padding: 16,
                  borderRadius: 2,
                  marginTop: 12,
                }}
              >
                <strong>Pending Ownership Transfer Request:</strong>
                <p style={{ margin: '6px 0', fontSize: 13 }}>
                  Transfer requested to: <code>{selectedLand.pendingTransfer.to}</code>
                </p>

                {/* If caller is the registrar who registered this land */}
                {wallet.account?.toLowerCase() === selectedLand.record.registrar.toLowerCase() && (
                  <div style={{ marginTop: 10 }}>
                    <button
                      type="button"
                      className="btn-success"
                      onClick={() => handleApproveTransfer(selectedLand.record.id)}
                    >
                      Approve Title Transfer on BOT Chain
                    </button>
                  </div>
                )}

                {/* If caller is the current owner */}
                {wallet.account?.toLowerCase() === selectedLand.record.owner.toLowerCase() && (
                  <div style={{ marginTop: 10 }}>
                    <button
                      type="button"
                      className="btn-danger btn-sm"
                      onClick={() => handleCancelTransfer(selectedLand.record.id)}
                    >
                      Cancel Transfer Request
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Unfreeze action if parcel is Frozen and caller is registrar */}
            {selectedLand.record.status === 'Frozen' &&
              selectedLand.record.openDisputes === 0 &&
              wallet.isRegistrar && (
                <div style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    className="btn-success"
                    onClick={() => handleUnfreeze(selectedLand.record.id)}
                  >
                    Unfreeze Parcel (All disputes cleared)
                  </button>
                </div>
              )}

            {/* Disputes History */}
            <div className="disputes-section">
              <h3>Disputes & Challenges ({selectedLand.disputes.length})</h3>
              {selectedLand.disputes.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>
                  No disputes filed against this parcel.
                </div>
              ) : (
                selectedLand.disputes.map((disp, idx) => (
                  <div key={disp.id} className="dispute-item">
                    <div>
                      <strong>
                        Challenge #{disp.id} by {formatAddress(disp.claimant)}
                      </strong>
                      <StatusBadge
                        tone={
                          disp.status === 'Open'
                            ? 'amber'
                            : disp.status === 'Upheld'
                            ? 'red'
                            : 'green'
                        }
                      >
                        {disp.status}
                      </StatusBadge>
                    </div>
                    <div>Note: {disp.note}</div>
                    <div style={{ color: 'var(--muted)', fontSize: 11 }}>
                      Evidence Hash: {formatAddress(disp.evidenceHash)} · Bond: 10 USDT ·{' '}
                      {formatTimestamp(disp.raisedAt)}
                    </div>

                    {/* Registrar resolution controls if dispute is open */}
                    {disp.status === 'Open' &&
                      wallet.isRegistrar &&
                      wallet.account?.toLowerCase() !==
                        selectedLand.record.registrar.toLowerCase() && (
                        <div className="action-row">
                          <button
                            type="button"
                            className="btn-danger btn-sm"
                            onClick={() => handleResolveDispute(selectedLand.record.id, idx, true)}
                          >
                            Uphold Dispute (Freeze Land)
                          </button>
                          <button
                            type="button"
                            className="btn-success btn-sm"
                            onClick={() => handleResolveDispute(selectedLand.record.id, idx, false)}
                          >
                            Reject Dispute (Forfeit Bond)
                          </button>
                        </div>
                      )}
                  </div>
                ))
              )}
            </div>

            {/* Ownership Transfer History */}
            <div className="history-section">
              <h3>Title Ownership History</h3>
              {selectedLand.history.map((h, i) => (
                <div key={i} className="history-item">
                  <div>
                    <strong>
                      {h.from === '0x0000000000000000000000000000000000000000'
                        ? 'Genesis Registration'
                        : `Transfer from ${formatAddress(h.from)}`}
                    </strong>
                    <span>{formatTimestamp(h.at)}</span>
                  </div>
                  <div>
                    <span>New Title Holder: </span>
                    <code>{h.to}</code>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link
                href={`/plot/${encodeURIComponent(selectedLand.record.plotId)}`}
                className="primary-button"
                style={{ textDecoration: 'none' }}
              >
                Open Shareable Page (/plot/{selectedLand.record.plotId}) <ExternalLink size={14} />
              </Link>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setSelectedLand(null)}
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="site-footer">
        <div>
          <strong>LANDVERIFY</strong>
          <span>Public, tamper-evident land records on BOT Chain.</span>
          <span style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
            Contract: <code>{REGISTRY_ADDRESS}</code>
          </span>
        </div>
        <div className="bot-chain-partner">
          <div>
            <span className="partner-label">Ecosystem partner</span>
            <strong>BOT Chain</strong>
          </div>
          <div className="partner-links">
            <a href="https://botchain.ai" target="_blank" rel="noreferrer">
              botchain.ai <ExternalLink size={13} />
            </a>
            <a
              href={`https://scan.bohr.life/address/${REGISTRY_ADDRESS}`}
              target="_blank"
              rel="noreferrer"
            >
              Verified Contract <ExternalLink size={13} />
            </a>
          </div>
        </div>
      </footer>
    </main>
  )
}
