'use client'

import { useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'
import {
  CHAIN_ID,
  CHAIN_HEX,
  BOT_CHAIN_CONFIG,
  getRegistryContract,
  getUsdtContract,
  getUsdtDecimals,
} from './contracts'

declare global {
  interface Window {
    ethereum?: any
  }
}

export interface WalletState {
  account: string | null
  chainId: number | null
  isCorrectNetwork: boolean
  isConnecting: boolean
  isRegistrar: boolean
  isContractOwner: boolean
  usdtBalance: string
  botBalance: string
  error: string | null
  connect: () => Promise<void>
  disconnect: () => void
  switchToBotChain: () => Promise<boolean>
  getSigner: () => Promise<ethers.Signer | null>
  refreshBalances: () => Promise<void>
}

export function useWallet(): WalletState {
  const [account, setAccount] = useState<string | null>(null)
  const [chainId, setChainId] = useState<number | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isRegistrar, setIsRegistrar] = useState(false)
  const [isContractOwner, setIsContractOwner] = useState(false)
  const [usdtBalance, setUsdtBalance] = useState('0')
  const [botBalance, setBotBalance] = useState('0')
  const [error, setError] = useState<string | null>(null)

  const isCorrectNetwork = chainId === CHAIN_ID

  const checkRolesAndBalances = useCallback(async (addr: string) => {
    try {
      const registry = getRegistryContract()
      const usdt = getUsdtContract()

      const [regCheck, ownerAddr, usdtRaw] = await Promise.all([
        registry.isRegistrar(addr).catch(() => false),
        registry.owner().catch(() => ''),
        usdt.balanceOf(addr).catch(() => BigInt(0)),
      ])

      setIsRegistrar(Boolean(regCheck))
      setIsContractOwner(
        Boolean(ownerAddr && ownerAddr.toLowerCase() === addr.toLowerCase())
      )
      const decimals = await getUsdtDecimals()
      setUsdtBalance(Number(ethers.formatUnits(usdtRaw, decimals)).toFixed(2))

      if (window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum)
        const balanceWei = await provider.getBalance(addr)
        setBotBalance(Number(ethers.formatEther(balanceWei)).toFixed(4))
      }
    } catch (err) {
      console.warn('Failed to load wallet details:', err)
    }
  }, [])

  const switchToBotChain = useCallback(async (): Promise<boolean> => {
    if (!window.ethereum) {
      setError('Please install MetaMask or another Web3 wallet.')
      return false
    }

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: CHAIN_HEX }],
      })
      return true
    } catch (switchError: any) {
      // 4902 code means the chain has not been added to MetaMask
      if (switchError.code === 4902 || switchError?.data?.originalError?.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [BOT_CHAIN_CONFIG],
          })
          return true
        } catch (addError: any) {
          setError(addError?.message || 'Failed to add BOT Chain to wallet.')
          return false
        }
      }
      setError(switchError?.message || 'Failed to switch network.')
      return false
    }
  }, [])

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setError('No Ethereum wallet detected. Please install MetaMask.')
      return
    }

    try {
      setIsConnecting(true)
      setError(null)

      const provider = new ethers.BrowserProvider(window.ethereum)
      const accounts = await provider.send('eth_requestAccounts', [])

      if (accounts && accounts.length > 0) {
        const currentAddr = accounts[0]
        setAccount(currentAddr)

        const network = await provider.getNetwork()
        const currentChainId = Number(network.chainId)
        setChainId(currentChainId)

        if (currentChainId !== CHAIN_ID) {
          const switched = await switchToBotChain()
          if (!switched) {
            setError(`Please switch your wallet to BOT Chain (Chain ID ${CHAIN_ID}).`)
          }
        }

        await checkRolesAndBalances(currentAddr)
      }
    } catch (err: any) {
      console.error('Wallet connection failed:', err)
      setError(err?.message || 'Failed to connect wallet.')
    } finally {
      setIsConnecting(false)
    }
  }, [checkRolesAndBalances, switchToBotChain])

  const disconnect = useCallback(() => {
    setAccount(null)
    setIsRegistrar(false)
    setIsContractOwner(false)
    setUsdtBalance('0')
    setBotBalance('0')
  }, [])

  const refreshBalances = useCallback(async () => {
    if (account) {
      await checkRolesAndBalances(account)
    }
  }, [account, checkRolesAndBalances])

  const getSigner = useCallback(async (): Promise<ethers.Signer | null> => {
    if (!window.ethereum) return null
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      return await provider.getSigner()
    } catch {
      return null
    }
  }, [])

  // Auto-detect existing connection and listen to provider events
  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return

    const handleAccountsChanged = async (accounts: string[]) => {
      if (accounts && accounts.length > 0) {
        setAccount(accounts[0])
        await checkRolesAndBalances(accounts[0])
      } else {
        disconnect()
      }
    }

    const handleChainChanged = (newChainIdHex: string) => {
      const numericId = parseInt(newChainIdHex, 16)
      setChainId(numericId)
      if (account) {
        checkRolesAndBalances(account)
      }
    }

    window.ethereum.on('accountsChanged', handleAccountsChanged)
    window.ethereum.on('chainChanged', handleChainChanged)

    // Check if already authorized
    const provider = new ethers.BrowserProvider(window.ethereum)
    provider.send('eth_accounts', []).then(async (accounts: string[]) => {
      if (accounts && accounts.length > 0) {
        setAccount(accounts[0])
        const network = await provider.getNetwork()
        setChainId(Number(network.chainId))
        await checkRolesAndBalances(accounts[0])
      }
    }).catch(() => {})

    return () => {
      if (window.ethereum?.removeListener) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged)
        window.ethereum.removeListener('chainChanged', handleChainChanged)
      }
    }
  }, [account, checkRolesAndBalances, disconnect])

  return {
    account,
    chainId,
    isCorrectNetwork,
    isConnecting,
    isRegistrar,
    isContractOwner,
    usdtBalance,
    botBalance,
    error,
    connect,
    disconnect,
    switchToBotChain,
    getSigner,
    refreshBalances,
  }
}
