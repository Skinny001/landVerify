# PRD 05: LandVerify

**Tagline:** Check a land document before you buy. Register a C of O hash on-chain, see if a plot is registered or disputed, and fight double-selling and land grabbing.
**Target:** BOT Chain Testnet (chain ID 968)
**Stack:** Solidity ^0.8.24, Foundry (forge), OpenZeppelin v5, Next.js (App Router), ethers v6

---

## 0. Common setup (same in every PRD)

| Item | Value |
|---|---|
| Network | BOT Chain Testnet |
| Chain ID | 968 (hex `0x3C8`) |
| RPC | `https://rpc.bohr.life` |
| Explorer | `https://scan.bohr.life` |
| Native token | tBOT (gas). Faucet: `https://faucet.botchain.ai/basic`, 10 tBOT per address per 24h |
| USDT (testnet) | `0x75edC9335175Fc0552D51D48439F229c10420fe3` |

Rules for the whole build:
- The docs do not state USDT decimals. Always read `decimals()` from the token. Never hardcode 6 or 18.
- How you get test USDT is not documented. Day 1: check the faucet and bridge pages. If you cannot get any, deploy your own `MockUSDT` and set `NEXT_PUBLIC_USDT_ADDRESS`. Put this in your README.
- Do not rely on `eth_getLogs` for core data. Store data in contract state and read it with view functions.
- Deploy with: `forge script script/Deploy.s.sol --rpc-url https://rpc.bohr.life --broadcast --private-key $PRIVATE_KEY`. Add `--legacy` if you hit a gas price error.
- tBOT is limited (10 per day per address). Test locally with `forge test` first.

---

## 1. Overview

Land fraud in Nigeria often involves the same plot being sold to several buyers, forged documents, or a quiet claim by a third party. LandVerify gives buyers a public place to check a plot before paying. A registrar records a document fingerprint (hash) of the Certificate of Occupancy (C of O) and the plot's identity. Anyone can then verify a document and see whether the plot is registered, disputed, or frozen. Anyone with a claim can raise a dispute with a USDT bond, and the registrar resolves it.

**What this system proves (state it in the UI and README):** It proves that a specific document was registered by an authorized registrar at a specific time and shows the dispute status. It does NOT prove legal ownership. Legal title remains with the land registry and the courts. The chain is a transparent, tamper-evident layer on top.

## 2. Assumptions (decisions already made)

1. **Registrar model:** Admin registers Registrars (representing a land registry, a surveyor, or a licensed lawyer). Only registrars can register land records and resolve disputes.
2. **Privacy:** The document never leaves the user's browser. The frontend computes `keccak256` of the file locally and sends only the hash. Optional encrypted copy on IPFS is out of scope.
3. **Plot identity:** `plotId` is a string such as a survey plan number plus a state/LGA code. Optionally a `geoCell` (a geohash or lat/long rounded to 4 decimals as a string) to help catch duplicates.
4. **Duplicates:** The contract blocks registering the same `docHash` or the same `plotId` twice.
5. **Disputes:** Any address can raise a dispute against a registered plot by posting a USDT bond (default 10 USDT-equivalent in base units, admin configurable) and an `evidenceHash`. A registrar reviews and resolves: Upheld (bond refunded, plot becomes Frozen until a registrar updates it) or Rejected (bond forfeited to the treasury).
6. **Ownership transfer:** The current owner requests a transfer to a new address; the registrar approves it. History is kept in an array.
7. **Statuses:** `Registered`, `Disputed`, `Frozen`.

## 3. Users and roles

| Role | Can do |
|---|---|
| Admin | Add/remove registrars, set dispute bond and treasury |
| Registrar | Register land records, resolve disputes, approve transfers, unfreeze |
| Owner | Request transfer of their recorded plot |
| Anyone | Verify a document hash, view history, raise a dispute |

## 4. User stories

- As a buyer, I drop the seller's C of O file into the page and get an instant result: not found, registered (with date and registrar), disputed, or frozen.
- As a registrar, I register a plot with `plotId`, `docHash`, owner address and a short description.
- As someone with a competing claim, I raise a dispute with evidence hash and bond.
- As a registrar, I review disputes and mark them upheld or rejected.
- As an owner, I request a transfer to a buyer; the registrar approves; the history shows both parties.
- As anyone, I search by `plotId` to see the status and ownership history.

## 5. Scope

**MVP:** registrar roles, register record, verify by hash, search by plot ID, raise dispute with bond, resolve dispute, transfer request and approval, history timeline, public verify page with local hashing.

**Out of scope:** GIS maps, document OCR, real government integration, encrypted document storage, court integration.

## 6. Smart contract specification

### 6.1 Contracts

1. `LandRegistry.sol`: records, disputes, transfers.
2. `MockUSDT.sol` (tests only).

### 6.2 Data structures

```solidity
enum LandStatus { Registered, Disputed, Frozen }
enum DisputeStatus { Open, Upheld, Rejected }

struct LandRecord {
    uint256 id;
    string plotId;
    bytes32 docHash;
    address owner;
    address registrar;
    string description;       // max 200 bytes: area, address, etc.
    string geoCell;           // optional
    uint64 registeredAt;
    LandStatus status;
    uint32 openDisputes;
}

struct Dispute {
    uint256 id;
    uint256 landId;
    address claimant;
    bytes32 evidenceHash;
    string note;              // max 200 bytes
    uint256 bond;
    uint64 raisedAt;
    DisputeStatus status;
}

struct Transfer {
    address from;
    address to;
    uint64 at;
    bytes32 newDocHash;       // optional: updated document hash for the new owner
}

struct TransferRequest {
    address to;
    bytes32 newDocHash;
    bool pending;
}
```

State:
- `mapping(uint256 => LandRecord) lands`, `uint256 nextLandId`
- `mapping(bytes32 => uint256) landByDocHash` (0 = none)
- `mapping(bytes32 => uint256) landByPlotKey` (key = keccak256(plotId))
- `mapping(uint256 => Dispute[]) disputesByLand` (or global mapping + list)
- `mapping(uint256 => Transfer[]) historyOf`
- `mapping(uint256 => TransferRequest) pendingTransfer`
- `mapping(address => bool) isRegistrar`, `uint256 disputeBond`, `address treasury`, `IERC20 usdt`

### 6.3 Functions

| Function | Access | Behavior |
|---|---|---|
| `addRegistrar/removeRegistrar` | Admin | Role registry |
| `setDisputeBond(amount)`, `setTreasury(addr)` | Admin | Config |
| `registerLand(plotId, docHash, owner, description, geoCell)` | Registrar | Reverts if `docHash` or `plotId` already used; creates record Registered; pushes first history entry (from = address(0)) |
| `verify(bytes32 docHash)` view | Anyone | Returns (found, landId, status, owner, registrar, registeredAt, openDisputes) |
| `getByPlotId(string plotId)` view | Anyone | Same data by plot |
| `raiseDispute(landId, evidenceHash, note)` | Anyone except the owner | Pulls `disputeBond` USDT; creates Open dispute; sets status Disputed; increments `openDisputes` |
| `resolveDispute(landId, disputeIdx, bool upheld)` | Registrar (not the registrar who registered that plot, to reduce conflict of interest; configurable) | Upheld: refund bond, set land status Frozen. Rejected: send bond to treasury. Decrement `openDisputes`; if zero and not Frozen, status returns to Registered |
| `unfreeze(landId)` | Registrar | Only when `openDisputes == 0`; status back to Registered |
| `requestTransfer(landId, to, newDocHash)` | Owner | Only when status is Registered; stores pending request |
| `approveTransfer(landId)` | Registrar | Only when status Registered and request pending; updates owner and `docHash` mapping if `newDocHash` provided (ensure uniqueness); appends history |
| `cancelTransfer(landId)` | Owner | Clears request |
| Views | Anyone | `getLand(id)`, `getDisputes(landId)`, `getHistory(landId)` |

Key rule: transfers and re-registration are blocked while `Disputed` or `Frozen`. This is what protects a buyer.

### 6.4 Events

`RegistrarAdded`, `LandRegistered(id, plotId, docHash, owner)`, `DisputeRaised`, `DisputeResolved`, `LandFrozen`, `LandUnfrozen`, `TransferRequested`, `TransferApproved`.

### 6.5 Security checklist

- Reentrancy guard on dispute functions; SafeERC20.
- Bond accounting: every bond pulled is either refunded or sent to treasury exactly once.
- Strings capped by byte length. Hash inputs are bytes32 so no ambiguity.
- A registrar cannot resolve a dispute on a record they registered (default), and cannot register a record for themselves as owner (revert).

## 7. Frontend specification (Next.js + ethers v6)

### 7.1 Pages

| Route | Purpose |
|---|---|
| `/` | Hero + the main action: drag and drop a document or enter a plot ID |
| `/verify` | Local hash computing (read the file with `FileReader`, hash with `ethers.keccak256` on bytes), call `verify(hash)`, show a clear status card (green Registered, amber Disputed, red Frozen, grey Not found) |
| `/plot/[plotId]` | Details, status, ownership history timeline, disputes list, "Raise dispute" button |
| `/registrar` | Register land (file picker hashes locally, owner address, plot ID, description), pending transfers, open disputes with resolve buttons |
| `/dispute/[landId]` | Dispute form: evidence file (hashed locally), note, bond amount display, approve and raise |
| `/owner` | My plots, request transfer |
| `/admin` | Registrars, bond, treasury |

### 7.2 Behavior

- **No file upload to any server.** Show a visible badge: "Your document never leaves your device. Only its fingerprint is checked."
- Explain the result: a "What this means" panel under each verification result, including the legal disclaimer.
- Show a "Share verification" link `/plot/[plotId]` for buyers and lawyers.
- Dispute flow: approve USDT then `raiseDispute`; show the bond clearly before signing.
- Wallet connect and chain switching per the common setup. Reading verification results should work without a wallet using a public `JsonRpcProvider`.
- Hash note: ethers `keccak256` takes a `Uint8Array`, so read the file as an `ArrayBuffer`.

## 8. Off-chain data

None required. Optional: store a copy of evidence on IPFS later. Keep demo documents as sample PDFs in `/public/samples` so reviewers can try verification.

## 9. Foundry test plan

- Registrar management: only admin.
- `registerLand`: non-registrar reverts; duplicate `docHash` and duplicate `plotId` revert; self-owner by registrar reverts.
- `verify`: found and not found cases; status reflects disputes.
- Dispute: owner cannot dispute own plot; bond pulled; status changes to Disputed; multiple disputes counted.
- Resolve: upheld refunds bond and freezes; rejected forfeits to treasury; registrar who registered the plot cannot resolve; counts decrement correctly.
- Transfer: blocked when disputed or frozen; approved transfer updates owner and history; `newDocHash` uniqueness enforced.
- Bond conservation fuzz: contract USDT balance equals sum of unresolved bonds.

## 10. Project structure

```
landverify/
  contracts/ src/LandRegistry.sol
             test/LandRegistry.t.sol, mocks/MockUSDT.sol
             script/Deploy.s.sol, script/SeedDemo.s.sol
  web/ app/..., lib/hash.ts, components/VerifyCard.tsx, Timeline.tsx
  public/samples/
  README.md
```

Env: `PRIVATE_KEY`, `NEXT_PUBLIC_REGISTRY_ADDRESS`, `NEXT_PUBLIC_USDT_ADDRESS`.

## 11. Build order

1. Contract core (register + verify) + tests. 2. Disputes + bond + tests. 3. Transfers + tests. 4. Deploy and seed 3 demo plots (one clean, one disputed, one frozen). 5. Verify page with local hashing. 6. Registrar and dispute flows. 7. History timeline, polish, README.

## 12. Acceptance criteria

- [ ] All forge tests pass.
- [ ] Testnet deployment with three seeded demo plots with different statuses.
- [ ] Verify page works by dropping a sample file and by plot ID, without a wallet.
- [ ] Transfers are blocked on disputed or frozen plots.
- [ ] Legal disclaimer visible in UI and README.

## 13. Risks and notes

- Garbage in, garbage out: if a registrar registers a forged document, the chain records it faithfully. Say this plainly. Trust shifts to the registrar, and registrar identities are public, which makes misconduct traceable.
- Hash sensitivity: any change to the file (even re-saving a PDF) changes the hash. Explain this in the UI.
