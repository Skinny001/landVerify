// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {LandRegistry} from "../src/LandRegistry.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract SeedDemo is Script {
    function run() external returns (LandRegistry registry) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address usdtAddr = vm.envAddress("USDT_ADDRESS");
        address treasury = vm.envOr("TREASURY", deployer);

        console2.log("Deployer:", deployer);
        console2.log("USDT address:", usdtAddr);

        // Deterministic secondary registrar key
        uint256 reg2Key = uint256(keccak256(abi.encodePacked("LANDVERIFY_REGISTRAR_2_SALT")));
        address registrar2 = vm.addr(reg2Key);
        console2.log("Registrar 2:", registrar2);

        bytes32 docHash1 = 0x5d7ba215d6bd8f73a564317e32cc870d96efa235f8dc9759657f64f1f8fd9be5;
        bytes32 docHash2 = 0x00c2af95c18a8e11cddcf3a3af19b1688c1408238579c72a241bb452c2861ea6;
        bytes32 docHash3 = 0xd767a0ec07b9052af59233f87f43a63b24e23818d3271aa6a99ead21d65f5f6e;

        vm.startBroadcast(deployerKey);

        // 1. Deploy LandRegistry
        registry = new LandRegistry(usdtAddr, treasury);
        console2.log("LandRegistry deployed at:", address(registry));

        // 2. Add registrars
        registry.addRegistrar(deployer);
        registry.addRegistrar(registrar2);

        // 3. Fund registrar2 with a bit of native BOT for resolving Plot 3
        (bool funded, ) = payable(registrar2).call{value: 0.05 ether}("");
        require(funded, "funding reg2 failed");

        // 4. Register Plot 1 (Clean)
        registry.registerLand(
            "LAG-IKJ-0421",
            docHash1,
            0x1111111111111111111111111111111111111111,
            "1,250 sqm Commercial Plot, Ikeja GRA, Lagos State",
            "6.5954, 3.3541"
        );
        console2.log("Plot 1 registered: LAG-IKJ-0421");

        // 5. Register Plot 2 (Disputed)
        uint256 id2 = registry.registerLand(
            "ABJ-MAI-1188",
            docHash2,
            0x2222222222222222222222222222222222222222,
            "800 sqm Residential Plot, Maitama District, Abuja, FCT",
            "9.0882, 7.4913"
        );
        console2.log("Plot 2 registered: ABJ-MAI-1188");

        // 6. Register Plot 3 (Frozen)
        uint256 id3 = registry.registerLand(
            "KAN-NAS-0089",
            docHash3,
            0x3333333333333333333333333333333333333333,
            "2,500 sqm Industrial Parcel, Nassarawa GRA, Kano State",
            "12.0022, 8.5919"
        );
        console2.log("Plot 3 registered: KAN-NAS-0089");

        // 7. Approve USDT for disputes (10 USDT each = 20 USDT)
        IERC20(usdtAddr).approve(address(registry), 20e6);

        // 8. Raise dispute on Plot 2 (Open)
        bytes32 evidence2 = keccak256("FCT High Court Suit CV/2024/912 - Injunction");
        registry.raiseDispute(
            id2,
            evidence2,
            "Boundary overlap claim filed under FCT High Court suit CV/2024/912."
        );
        console2.log("Dispute raised on Plot 2");

        // 9. Raise dispute on Plot 3
        bytes32 evidence3 = keccak256("Kano State Lands Bureau Revocation Order KAN/REV/2023/44");
        registry.raiseDispute(
            id3,
            evidence3,
            "Revocation notice served by Kano State Lands Bureau for public easement."
        );
        console2.log("Dispute raised on Plot 3");

        vm.stopBroadcast();

        // 10. Registrar 2 upholds dispute on Plot 3 -> becomes Frozen!
        vm.startBroadcast(reg2Key);
        registry.resolveDispute(id3, 0, true);
        console2.log("Registrar 2 upheld dispute on Plot 3 -> Frozen!");
        vm.stopBroadcast();
    }
}
