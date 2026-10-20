// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Deploy} from "../script/Deploy.s.sol";
import {LandRegistry} from "../src/LandRegistry.sol";
import {MockUSDT} from "../src/mocks/MockUSDT.sol";

contract DeployScriptTest is Test {
    Deploy public deployScript;
    MockUSDT public mockUsdt;
    uint256 public constant DEPLOYER_KEY = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef;

    function setUp() public {
        deployScript = new Deploy();
        mockUsdt = new MockUSDT();
    }

    function test_DeployScript_Run() public {
        address deployer = vm.addr(DEPLOYER_KEY);
        vm.setEnv("PRIVATE_KEY", vm.toString(bytes32(DEPLOYER_KEY)));
        vm.setEnv("USDT_ADDRESS", vm.toString(address(mockUsdt)));

        LandRegistry reg = deployScript.run();

        assertEq(address(reg.usdt()), address(mockUsdt));
        assertEq(reg.owner(), deployer);
        assertEq(reg.treasury(), deployer);
        assertTrue(reg.isRegistrar(deployer));
    }
}
