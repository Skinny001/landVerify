'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import {
  ShieldCheck,
  AlertTriangle,
  Lock,
  Search,
  ExternalLink,
  Copy,
  Check,
  ArrowLeft,
  Calendar,
  MapPin,
  User,
  BadgeCheck,
  FileText,
  Scale,
  History,
  Upload,
  Clock,
  Info,
} from 'lucide-react'
import { keccak256 } from 'ethers'
import {
  REGISTRY_ADDRESS,
  CHAIN_ID,
  formatAddress,
  formatTimestamp,
  OnChainLandRecord,
  OnChainTransfer,
  OnChainDispute,
} from '@/lib/contracts'
import { verifyByPlotId, fetchLandDetails, FullLandDetails } from '@/lib/registryService'

export default function PlotDetailPage({
  params,
}: {
  params: Promise<{ plotId: string }>
}) {
  const resolvedParams = use(params)
  const plotIdParam = decodeURIComponent(resolvedParams.plotId)

  const [loading, setLoading] = useState(true)
  const [details, setDetails] = useState<FullLandDetails | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Compare file tool state
  const [compareFile, setCompareFile] = useState<File | null>(null)
  const [compareHash, setCompareHash] = useState<string>('')
  const [isComparing, setIsComparing] = useState(false)

  useEffect(() => {
    async function loadPlot() {
      setLoading(true)
      setError(null)
      try {
        const res = await verifyByPlotId(plotIdParam)
        if (res.found && res.details) {
          setDetails(res.details)
        } else {
          // Fallback: check if param is a numeric ID
          const numId = Number(plotIdParam)
          if (!isNaN(numId) && numId > 0) {
            const byId = await fetchLandDetails(numId)
            if (byId) {
              setDetails(byId)
              return
            }
          }
          setError(`No registered land parcel found matching identifier "${plotIdParam}".`)
        }
      } catch (err: any) {
        console.error('Failed to load parcel:', err)
        setError('Failed to fetch on-chain parcel details from BOT Chain.')
      } finally {
        setLoading(false)
      }
    }

    loadPlot()
  }, [plotIdParam])

  async function handleCompareFile(file?: File) {
    if (!file || !details) return
    setCompareFile(file)
    setIsComparing(true)
    try {
      const buffer = await file.arrayBuffer()
      const hash = keccak256(new Uint8Array(buffer))
      setCompareHash(hash)
    } finally {
      setIsComparing(false)
    }
  }

  function handleCopyShareLink() {
    if (typeof window === 'undefined') return
    const url = window.location.href
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const record = details?.record
  const history = details?.history || []
  const disputes = details?.disputes || []

  const isHashMatch =
    compareHash && record?.docHash && compareHash.toLowerCase() === record.docHash.toLowerCase()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', color: 'var(--ink)' }}>
      {/* Navigation */}
      <header className="nav">
        <Link href="/" className="brand" style={{ display: 'inline-flex', alignItems: 'center' }}>
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
          <span>LAND</span>
          <span>VERIFY</span>
        </Link>
        <div className="nav-links">
          <Link href="/">Overview</Link>
          <Link href="/#verify" className="active">
            Verify Station
          </Link>
          <a
            href={`https://scan.bohr.life/address/${REGISTRY_ADDRESS}`}
            target="_blank"
            rel="noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            Explorer <ExternalLink size={12} />
          </a>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 24px 100px' }}>
        {/* Back breadcrumb */}
        <div style={{ marginBottom: 28 }}>
          <Link
            href="/#verify"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--green)',
              textDecoration: 'none',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            <ArrowLeft size={14} /> Back to Verify Station
          </Link>
        </div>

        {loading && (
          <div
            style={{
              background: 'var(--paper)',
              padding: 60,
              border: '1px solid var(--line)',
              textAlign: 'center',
            }}
          >
            <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 16px' }} />
            <h3 style={{ margin: 0, fontSize: 20 }}>Querying BOT Chain RPC...</h3>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 6 }}>
              Reading verified land record for <strong>{plotIdParam}</strong>
            </p>
          </div>
        )}

        {error && !loading && (
          <div
            style={{
              background: 'var(--paper)',
              border: '1px solid var(--line)',
              padding: 48,
              textAlign: 'center',
            }}
          >
            <AlertTriangle size={48} color="var(--amber)" style={{ margin: '0 auto 16px' }} />
            <h2 style={{ margin: '0 0 10px', fontSize: 28 }}>Parcel Record Not Found</h2>
            <p style={{ color: 'var(--muted)', maxWidth: 500, margin: '0 auto 24px' }}>
              {error} Please check the survey plan code or return to the main registry.
            </p>
            <Link href="/#verify" className="primary-button">
              Search Land Registry
            </Link>
          </div>
        )}

        {record && !loading && (
          <>
            {/* Header Hero Card */}
            <div
              style={{
                background: 'var(--paper)',
                border: '1px solid var(--line)',
                padding: '36px 36px 32px',
                boxShadow: '0 12px 30px rgba(17,34,29,0.05)',
                marginBottom: 28,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: 16,
                  borderBottom: '1px solid var(--line)',
                  paddingBottom: 24,
                }}
              >
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      marginBottom: 8,
                    }}
                  >
                    <span className="eyebrow">
                      <span className="eyebrow-line" />
                      Land Parcel Record #{record.id}
                    </span>
                    {record.status === 'Registered' && (
                      <span className="status status-green">
                        <span className="status-dot" /> Verified Clean Title
                      </span>
                    )}
                    {record.status === 'Disputed' && (
                      <span className="status status-amber">
                        <span className="status-dot" /> Active Dispute ({record.openDisputes})
                      </span>
                    )}
                    {record.status === 'Frozen' && (
                      <span className="status status-red">
                        <span className="status-dot" /> Title Frozen by Registrar
                      </span>
                    )}
                  </div>
                  <h1
                    style={{
                      margin: '6px 0 10px',
                      fontSize: 'clamp(32px, 4vw, 48px)',
                      letterSpacing: '-0.04em',
                    }}
                  >
                    {record.plotId}
                  </h1>
                  <p style={{ color: 'var(--muted)', fontSize: 16, margin: 0, maxWidth: 650 }}>
                    {record.description}
                  </p>
                </div>

                {/* Share link button */}
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <button
                    onClick={handleCopyShareLink}
                    className="btn-secondary"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '11px 18px',
                      background: copied ? 'var(--lime)' : 'transparent',
                      color: copied ? 'var(--ink)' : 'inherit',
                      transition: 'all 0.2s',
                    }}
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? 'Link Copied to Clipboard!' : 'Share Verification Link'}
                  </button>
                  <a
                    href={`https://scan.bohr.life/address/${REGISTRY_ADDRESS}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    Contract <ExternalLink size={13} />
                  </a>
                </div>
              </div>

              {/* Status Warning Banner if Disputed or Frozen */}
              {record.status === 'Disputed' && (
                <div
                  style={{
                    background: '#fef7e7',
                    border: '1px solid #f9d888',
                    color: 'var(--amber)',
                    padding: '16px 20px',
                    margin: '22px 0 0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                  }}
                >
                  <AlertTriangle size={24} style={{ flexShrink: 0 }} />
                  <div>
                    <strong style={{ display: 'block', fontSize: 14, color: '#7a4f0b' }}>
                      CAUTION: This parcel has {record.openDisputes} active dispute(s) locked with USDT bonds.
                    </strong>
                    <span style={{ fontSize: 12, color: '#976a1f' }}>
                      Transfers are blocked by smart contract rules until an independent registrar resolves the claim.
                    </span>
                  </div>
                </div>
              )}

              {record.status === 'Frozen' && (
                <div
                  style={{
                    background: '#fdf2f1',
                    border: '1px solid #f5c4c0',
                    color: 'var(--red)',
                    padding: '16px 20px',
                    margin: '22px 0 0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                  }}
                >
                  <Lock size={24} style={{ flexShrink: 0 }} />
                  <div>
                    <strong style={{ display: 'block', fontSize: 14, color: '#8c2e27' }}>
                      WARNING: This title has been FROZEN following an upheld dispute.
                    </strong>
                    <span style={{ fontSize: 12, color: '#a64a44' }}>
                      The smart contract prohibits any ownership conveyance, mortgage, or transfer of this parcel.
                    </span>
                  </div>
                </div>
              )}

              {/* Detailed Metrics Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 16,
                  marginTop: 24,
                }}
              >
                <div style={{ padding: 16, background: '#f6f5ef', border: '1px solid var(--line)' }}>
                  <span className="card-label">Registered Owner</span>
                  <strong style={{ fontSize: 14, display: 'block', marginTop: 4 }}>
                    {formatAddress(record.owner)}
                  </strong>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>Grantee address</span>
                </div>
                <div style={{ padding: 16, background: '#f6f5ef', border: '1px solid var(--line)' }}>
                  <span className="card-label">Authorized Registrar</span>
                  <strong style={{ fontSize: 14, display: 'block', marginTop: 4 }}>
                    {formatAddress(record.registrar)}
                  </strong>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>Recorded on-chain</span>
                </div>
                <div style={{ padding: 16, background: '#f6f5ef', border: '1px solid var(--line)' }}>
                  <span className="card-label">Cadastral GeoCell</span>
                  <strong style={{ fontSize: 14, display: 'block', marginTop: 4 }}>
                    {record.geoCell || 'Unspecified'}
                  </strong>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>GPS coordinate anchor</span>
                </div>
                <div style={{ padding: 16, background: '#f6f5ef', border: '1px solid var(--line)' }}>
                  <span className="card-label">Registration Date</span>
                  <strong style={{ fontSize: 14, display: 'block', marginTop: 4 }}>
                    {formatTimestamp(record.registeredAt)}
                  </strong>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>BOT Chain block time</span>
                </div>
              </div>

              {/* Cryptographic Document Hash Box */}
              <div className="hash-box" style={{ marginTop: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>On-Chain Document Fingerprint (keccak256):</span>
                  <span style={{ color: 'var(--muted)', fontSize: 10 }}>IMMUTABLE BLAKE/KECCAK</span>
                </div>
                <strong style={{ wordBreak: 'break-all', fontSize: 13 }}>{record.docHash}</strong>
              </div>
            </div>

            {/* Document Matcher / Live Authenticator */}
            <div
              style={{
                background: 'var(--paper)',
                border: '1px solid var(--line)',
                padding: 32,
                marginBottom: 28,
              }}
            >
              <div style={{ maxWidth: 680, marginBottom: 20 }}>
                <span className="section-kicker">Buyer & Lawyer Due Diligence</span>
                <h3 style={{ margin: '6px 0 10px', fontSize: 24, letterSpacing: '-0.03em' }}>
                  Compare Seller's Document Fingerprint
                </h3>
                <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>
                  Drop the seller's C of O or deed PDF below. Your browser computes its keccak256
                  hash locally and compares it with the on-chain hash above. The file is NEVER
                  uploaded to any server.
                </p>
              </div>

              <label
                style={{
                  border: '2px dashed var(--line)',
                  padding: 36,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 12,
                  background: isHashMatch ? '#e8f5e9' : 'white',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'background 0.2s',
                }}
              >
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => handleCompareFile(e.target.files?.[0])}
                  style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                />
                <Upload size={32} color={isHashMatch ? 'var(--green)' : 'var(--muted)'} />
                <div style={{ textAlign: 'center' }}>
                  <strong style={{ display: 'block', fontSize: 14 }}>
                    {compareFile ? compareFile.name : 'Select or drop seller’s document here'}
                  </strong>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                    PDF, PNG, JPG (Local hashing via ethers.keccak256)
                  </span>
                </div>
              </label>

              {compareHash && (
                <div style={{ marginTop: 20 }}>
                  <div className="hash-box" style={{ background: '#1c2826' }}>
                    <span>Computed Fingerprint of Dropped File:</span>
                    <strong style={{ wordBreak: 'break-all', fontSize: 13 }}>{compareHash}</strong>
                  </div>

                  {isHashMatch ? (
                    <div
                      style={{
                        background: '#e3f0df',
                        border: '1px solid #c2e2ba',
                        color: 'var(--green)',
                        padding: 16,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                      }}
                    >
                      <BadgeCheck size={28} />
                      <div>
                        <strong style={{ display: 'block', fontSize: 15 }}>
                          PERFECT 100% CRYPTOGRAPHIC MATCH!
                        </strong>
                        <span style={{ fontSize: 12 }}>
                          This document is bit-for-bit identical to the official record authenticated
                          by registrar {formatAddress(record.registrar)}.
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        background: '#fbe9e7',
                        border: '1px solid #f2c0bb',
                        color: '#ae4d46',
                        padding: 16,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                      }}
                    >
                      <AlertTriangle size={28} />
                      <div>
                        <strong style={{ display: 'block', fontSize: 15 }}>
                          MISMATCH DETECTED — POSSIBLE FORGERY OR ALTERATION
                        </strong>
                        <span style={{ fontSize: 12 }}>
                          The document you provided does NOT match the official on-chain hash for
                          this plot. Do NOT disburse funds until this discrepancy is investigated.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Ownership History Timeline */}
            <div
              style={{
                background: 'var(--paper)',
                border: '1px solid var(--line)',
                padding: 32,
                marginBottom: 28,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <History size={22} color="var(--green)" />
                <h3 style={{ margin: 0, fontSize: 22, letterSpacing: '-0.02em' }}>
                  Ownership Chain & Audit Trail ({history.length} Event{history.length === 1 ? '' : 's'})
                </h3>
              </div>

              {history.length === 0 ? (
                <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>
                  No ownership transfer history recorded.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {history.map((tx, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: 16,
                        background: 'white',
                        border: '1px solid var(--line)',
                        display: 'grid',
                        gridTemplateColumns: 'auto 1fr auto',
                        gap: 16,
                        alignItems: 'center',
                      }}
                    >
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: idx === 0 ? 'var(--lime)' : '#e9ebe2',
                          color: 'var(--ink)',
                          display: 'grid',
                          placeItems: 'center',
                          fontWeight: 800,
                          fontSize: 12,
                        }}
                      >
                        #{idx + 1}
                      </div>
                      <div>
                        <strong style={{ display: 'block', fontSize: 14 }}>
                          {tx.from === '0x0000000000000000000000000000000000000000'
                            ? `Genesis Registration → ${formatAddress(tx.to)}`
                            : `Conveyance: ${formatAddress(tx.from)} → ${formatAddress(tx.to)}`}
                        </strong>
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                          Document Fingerprint:{' '}
                          <code style={{ fontSize: 11 }}>{formatAddress(tx.newDocHash)}</code>
                        </span>
                      </div>
                      <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--muted)' }}>
                        <Clock size={12} style={{ display: 'inline', marginRight: 4 }} />
                        {formatTimestamp(tx.at)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Disputes Registry */}
            <div
              style={{
                background: 'var(--paper)',
                border: '1px solid var(--line)',
                padding: 32,
                marginBottom: 28,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <Scale size={22} color="var(--amber)" />
                <h3 style={{ margin: 0, fontSize: 22, letterSpacing: '-0.02em' }}>
                  Dispute & Escrow Registry ({disputes.length})
                </h3>
              </div>

              {disputes.length === 0 ? (
                <div style={{ padding: 20, background: '#f8faf7', border: '1px solid #d5e5d3' }}>
                  <p style={{ color: 'var(--green)', fontSize: 13, margin: 0, fontWeight: 700 }}>
                    ✓ No disputes or contested claims have been recorded against this parcel.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {disputes.map((disp, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: 18,
                        background: 'white',
                        border: '1px solid var(--line)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: 8,
                        }}
                      >
                        <span style={{ fontSize: 12, fontWeight: 800 }}>
                          Dispute Claim #{disp.id}
                        </span>
                        {disp.status === 'Open' && (
                          <span className="status status-amber">
                            <span className="status-dot" /> 10 USDT Bond Locked in Escrow
                          </span>
                        )}
                        {disp.status === 'Upheld' && (
                          <span className="status status-red">
                            <span className="status-dot" /> Dispute Upheld (Title Frozen)
                          </span>
                        )}
                        {disp.status === 'Rejected' && (
                          <span className="status status-green">
                            <span className="status-dot" /> Frivolous / Rejected (Bond Forfeited)
                          </span>
                        )}
                      </div>
                      <p style={{ margin: '6px 0 10px', fontSize: 13, color: 'var(--ink)' }}>
                        <strong>Claim Note:</strong> "{disp.note}"
                      </p>
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 16,
                          fontSize: 11,
                          color: 'var(--muted)',
                        }}
                      >
                        <span>Claimant: {formatAddress(disp.claimant)}</span>
                        <span>Evidence Fingerprint: {formatAddress(disp.evidenceHash)}</span>
                        <span>Raised Date: {formatTimestamp(disp.raisedAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Legal Notice / What this proves */}
            <div
              style={{
                background: '#f6f5ef',
                border: '1px solid var(--line)',
                padding: 28,
                fontSize: 12,
                lineHeight: 1.6,
                color: 'var(--muted)',
              }}
            >
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                <Info size={16} color="var(--green)" />
                <strong style={{ fontSize: 13, color: 'var(--ink)' }}>
                  What This Verification Proves & Does Not Prove (PRD §1 & §13 Compliance)
                </strong>
              </div>
              <p style={{ margin: '0 0 10px' }}>
                <strong>What it proves:</strong> This audit proves that the document matching
                cryptographic hash <code>{formatAddress(record.docHash)}</code> was registered by
                authorized registrar <code>{formatAddress(record.registrar)}</code> at block timestamp{' '}
                {formatTimestamp(record.registeredAt)}, and that its on-chain dispute status is
                currently <strong>{record.status}</strong>.
              </p>
              <p style={{ margin: '0 0 10px' }}>
                <strong>What it does not prove:</strong> This blockchain registry does not replace
                statutory Land Registries or judicial determinations. Trust shifts to the registrar,
                whose cryptographic identity is publicly recorded on-chain, rendering official
                misconduct verifiable and auditable.
              </p>
              <p style={{ margin: 0, fontSize: 11 }}>
                BOT Chain Testnet (Chain ID 968) · Smart Contract Address:{' '}
                <code>{REGISTRY_ADDRESS}</code>
              </p>
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="site-footer">
        <div>
          <strong>LandVerify Protocol</strong>
          <span>Fighting double-selling & fraudulent land conveyances on BOT Chain</span>
        </div>
        <div className="bot-chain-partner">
          <span className="partner-label">Target Network</span>
          <strong>BOT Chain Testnet</strong>
          <div className="partner-links">
            <a href="https://scan.bohr.life" target="_blank" rel="noreferrer">
              Explorer <ExternalLink size={11} />
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
