# LandVerify

**Tagline:** Check a land document before you buy. Register a C of O hash on-chain, see if a plot is registered or disputed, and fight double-selling and land grabbing in emerging markets.

LandVerify is an on-chain property title audit trail and bonded dispute resolution protocol built on **BOT Chain Testnet (Chain ID: 968)**.

---

## 🏛️ What This System Proves & Does NOT Prove (Legal Disclaimer)

> **What it proves:**
> LandVerify mathematically and immutably proves that a specific 32-byte cryptographic document fingerprint (`keccak256`) was attested by an authorized, accredited registrar at a specific BOT Chain block timestamp, and reveals real-time bonded dispute escrow statuses.

> **What it does NOT prove:**
> Blockchain verification **does NOT constitute sovereign legal title**. Legal title remains strictly governed by statutory land registries (e.g., State Lands Bureaus, AGIS) and competent courts of law. LandVerify provides a public, tamper-evident audit layer to eradicate duplicate conveyances, forged certificates, and covert claims.

### Key Risk Disclosures:
- **Garbage In, Garbage Out:** If an accredited registrar records a fraudulent instrument, the blockchain preserves it faithfully. However, registrar wallet identities are permanent, public, and auditable on-chain—eliminating anonymous bribery and making official misconduct verifiable.
- **Hash Sensitivity:** Keccak256 is highly sensitive to byte alterations. Any change to a file—including re-saving, annotating, or rotating a PDF—alters its hash completely. Always verify original source documents.

---

## ⚡ Live Deployments & Network Parameters

| Parameter | Value |
|---|---|
| **Network** | BOT Chain Testnet |
| **Chain ID** | `968` (Hex: `0x3C8`) |
| **RPC Endpoint** | `https://rpc.bohr.life` |
| **Block Explorer** | [https://scan.bohr.life](https://scan.bohr.life) |
| **LandRegistry Contract** | [`0x550Bdc072d03d70E0111dc2567b10FcAE3f1eda0`](https://scan.bohr.life/address/0x550Bdc072d03d70E0111dc2567b10FcAE3f1eda0) *(Verified on Explorer)* |
| **USDT Token (Testnet)** | [`0x75edC9335175Fc0552D51D48439F229c10420fe3`](https://scan.bohr.life/address/0x75edC9335175Fc0552D51D48439F229c10420fe3) |
| **Dispute Bond** | Dynamic (Default: 10 USDT in token base units) |
| **Gas Faucet** | [https://faucet.botchain.ai/basic](https://faucet.botchain.ai/basic) (10 tBOT per address/24h) |
| **Contract Deployer / Admin** | `0x372b4eB67006F68A9f296b23715055b8A878ABA9` |

---

## 📜 Three Seeded Live Demo Parcels (PRD §12)

The contract is pre-seeded with 3 live demo plots showcasing all possible protocol lifecycle statuses:

| Plot ID | State / Locality | Status | Open Disputes | DocHash (keccak256) |
|---|---|---|---|---|
| **`LAG-IKJ-0421`** | Ikeja GRA, Lagos State | **Registered (Clean)** | `0` | `0x5d7ba215d6bd8f73a564317e32cc870d96efa235f8dc9759657f64f1f8fd9be5` |
| **`ABJ-MAI-1188`** | Maitama, Abuja FCT | **Disputed (10 USDT Bond)** | `1` | `0x00c2af95c18a8e11cddcf3a3af19b1688c1408238579c72a241bb452c2861ea6` |
| **`KAN-NAS-0089`** | Nassarawa GRA, Kano | **Frozen (Title Blocked)** | `0` | `0xd767a0ec07b9052af59233f87f43a63b24e23818d3271aa6a99ead21d65f5f6e` |

### Sample PDF Documents (`/public/samples/`)
Realistic Nigerian title documents with state seals, survey plan references, and cadastral GPS coordinates are available in `public/samples/`:
1. [`LAG-IKJ-0421-CertificateOfOccupancy.pdf`](public/samples/LAG-IKJ-0421-CertificateOfOccupancy.pdf)
2. [`ABJ-MAI-1188-RightOfOccupancy.pdf`](public/samples/ABJ-MAI-1188-RightOfOccupancy.pdf)
3. [`KAN-NAS-0089-DeedOfAssignment.pdf`](public/samples/KAN-NAS-0089-DeedOfAssignment.pdf)

Reviewers can drop these PDFs directly into the verification dropzone on the web app to verify instantaneous client-side hash matching.

---

## 🔗 Dedicated Shareable Parcel Route (`/plot/[plotId]`)

Prospective buyers, bank mortgage officers, and conveyancing lawyers can directly access and share permanent on-chain verification links:
- `http://localhost:3000/plot/LAG-IKJ-0421` (Clean title)
- `http://localhost:3000/plot/ABJ-MAI-1188` (Active dispute)
- `http://localhost:3000/plot/KAN-NAS-0089` (Frozen title)

Features on each plot page:
- Live on-chain status query without requiring a connected wallet
- Interactive Document Hash Matcher (drops seller file to compare against registered hash)
- Historical ownership conveyance chain
- Dispute registry showing claimant, evidence hash, bond, and status
- One-click copy shareable verification link

---

## 🔒 Security & Architecture Rules

1. **Client-Side Privacy:** The user's document is read in browser memory using `FileReader.readAsArrayBuffer()` and fingerprinted with `ethers.keccak256`. No document or image is ever uploaded to any web server.
2. **Dynamic USDT Decimals:** Adheres strictly to PRD §0: never hardcodes 6 or 18 decimals; queries `usdt.decimals()` on-chain.
3. **Conflict of Interest Enforcement:**
   - A registrar cannot register a parcel for themselves as owner (`owner != msg.sender`).
   - The registrar who registered a parcel **cannot resolve disputes** on that parcel (`conflict registrar`).
   - Only the registering registrar can approve title transfers (`record registrar only`).
4. **Bond Conservation Invariant:**
   $$\text{USDT Balance}(\text{Registry}) = \sum \text{Open Disputes} \times \text{Dispute Bond}$$
   Fuzz tested over 256 randomized runs in Foundry (`testFuzz_BondConservation`).
5. **Transfer Locks:**
   Conveyance requests and approvals are strictly prohibited whenever a parcel is `Disputed` or `Frozen`.

---

## 🧪 Smart Contract Testing (Foundry)

The test suite covers 100% of the core lifecycle, access control, duplicate prevention, and escrow mechanics:

```bash
cd contracts
forge test
```

### Test Suite Summary:
- **45 Total Tests Passing (100% pass rate)**
- `testFuzz_BondConservation` (256 fuzz runs proving exact USDT conservation)
- `test_RegisterLand_*` (duplicate docHash, duplicate plotId, unauthorized sender, text length caps)
- `test_RaiseDispute_*` (bond transfer, multiple disputes, owner restriction)
- `test_ResolveDispute_*` (upheld refund to claimant, rejection forfeiture to treasury, conflict of interest)
- `test_TransferLifecycle_*` (request, approve with newDocHash, cancel, lock on disputed/frozen)
- `test_Unfreeze_*` (cleared disputes precondition)

---

## 🚀 Running the Web Application Locally

```bash
# Using npm
npm install
npm run dev

# Or using pnpm
pnpm install
pnpm dev

# Build for production
npm run build   # or pnpm build
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## 📁 Repository Structure

```
land-verify/
├── contracts/
│   ├── src/LandRegistry.sol           # Core registry, disputes, transfers
│   ├── test/LandRegistry.t.sol        # 44 Foundry unit & fuzz tests
│   ├── test/Deploy.t.sol              # Deployment script tests
│   ├── script/Deploy.s.sol            # Live deployment script
│   └── script/SeedDemo.s.sol          # 3-parcel testnet seeding script
├── app/
│   ├── page.tsx                       # Home, Verify, Workspaces (Registrar, Disputes, Owner, Admin)
│   ├── plot/[plotId]/page.tsx         # Dedicated shareable parcel route
│   └── globals.css                    # Design system tokens & responsive layouts
├── lib/
│   ├── contracts.ts                   # ABIs, addresses, dynamic USDT decimals helper
│   ├── registryService.ts             # On-chain read & write operations
│   └── useWallet.ts                   # Ethers v6 browser provider & network switcher
├── public/samples/                    # Sample C of O, R of O, and Deed PDFs
└── scripts/
    └── generateSamples.mjs            # Deterministic PDF generator for test files
```

---

## 📄 License
MIT License. Built for the BOT Chain ecosystem.
