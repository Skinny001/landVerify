# LandVerify contracts

Install OpenZeppelin and forge-std with `forge install OpenZeppelin/openzeppelin-contracts --no-commit` and `forge install foundry-rs/forge-std --no-commit`.

Run tests with `forge test` from this directory. Deploy to BOT Chain Testnet with `forge script script/Deploy.s.sol --rpc-url https://rpc.bohr.life --broadcast --private-key $PRIVATE_KEY`.

The contract stores document fingerprints only. It does not prove legal title; the land registry and courts remain authoritative.
