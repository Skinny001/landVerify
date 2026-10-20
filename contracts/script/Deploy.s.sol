// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Script} from "forge-std/Script.sol";
import {LandRegistry} from "../src/LandRegistry.sol";
contract Deploy is Script { function run() external returns (LandRegistry registry) { uint256 key = vm.envUint("PRIVATE_KEY"); address usdt = vm.envAddress("USDT_ADDRESS"); address treasury = vm.envOr("TREASURY", vm.addr(key)); vm.startBroadcast(key); registry = new LandRegistry(usdt, treasury); registry.addRegistrar(vm.addr(key)); vm.stopBroadcast(); } }
