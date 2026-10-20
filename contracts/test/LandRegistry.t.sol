// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {LandRegistry} from "../src/LandRegistry.sol";
import {MockUSDT} from "../src/mocks/MockUSDT.sol";

contract LandRegistryTest is Test {
    LandRegistry public registry;
    MockUSDT public usdt;

    address public owner = address(0xAA);
    address public treasury = address(0xBB);
    address public registrar1 = address(0x11);
    address public registrar2 = address(0x22);
    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);
    address public charlie = address(0xCC);

    string public defaultPlotId = "LAG-IKJ-0421";
    bytes32 public defaultDocHash = keccak256("Title Deed Certificate 12345");
    string public defaultDesc = "1,250 sqm Commercial Plot, Ikeja";
    string public defaultGeoCell = "886475653ffffff";

    event RegistrarAdded(address indexed registrar);
    event RegistrarRemoved(address indexed registrar);
    event LandRegistered(uint256 indexed id, string plotId, bytes32 docHash, address indexed owner);
    event DisputeRaised(uint256 indexed landId, uint256 indexed disputeId, address indexed claimant);
    event DisputeResolved(uint256 indexed landId, uint256 indexed disputeId, bool upheld);
    event LandFrozen(uint256 indexed landId);
    event LandUnfrozen(uint256 indexed landId);
    event TransferRequested(uint256 indexed landId, address indexed to);
    event TransferApproved(uint256 indexed landId, address indexed from, address indexed to);

    function setUp() public {
        vm.startPrank(owner);
        usdt = new MockUSDT();
        registry = new LandRegistry(address(usdt), treasury);

        registry.addRegistrar(registrar1);
        registry.addRegistrar(registrar2);
        vm.stopPrank();

        // Fund claimants with USDT
        usdt.mint(alice, 1000e6);
        usdt.mint(bob, 1000e6);
        usdt.mint(charlie, 1000e6);
    }

    // ==========================================
    // 1. CONSTRUCTOR & INITIALIZATION
    // ==========================================

    function test_Constructor_Success() public view {
        assertEq(address(registry.usdt()), address(usdt));
        assertEq(registry.treasury(), treasury);
        assertEq(registry.owner(), owner);
        assertEq(registry.disputeBond(), 10e6);
        assertEq(registry.nextLandId(), 1);
        assertEq(registry.nextDisputeId(), 1);
        assertTrue(registry.isRegistrar(registrar1));
        assertTrue(registry.isRegistrar(registrar2));
        assertFalse(registry.isRegistrar(alice));
    }

    function test_Constructor_RevertIfZeroAddress() public {
        vm.expectRevert("zero address");
        new LandRegistry(address(0), treasury);

        vm.expectRevert("zero address");
        new LandRegistry(address(usdt), address(0));
    }

    // ==========================================
    // 2. ADMIN FUNCTIONS
    // ==========================================

    function test_AddRegistrar_Success() public {
        address newReg = address(0x33);
        vm.prank(owner);
        vm.expectEmit(true, false, false, false);
        emit RegistrarAdded(newReg);
        registry.addRegistrar(newReg);

        assertTrue(registry.isRegistrar(newReg));
    }

    function test_AddRegistrar_RevertIfNotOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        registry.addRegistrar(address(0x33));
    }

    function test_AddRegistrar_RevertIfZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert("zero address");
        registry.addRegistrar(address(0));
    }

    function test_RemoveRegistrar_Success() public {
        vm.prank(owner);
        vm.expectEmit(true, false, false, false);
        emit RegistrarRemoved(registrar1);
        registry.removeRegistrar(registrar1);

        assertFalse(registry.isRegistrar(registrar1));
    }

    function test_RemoveRegistrar_RevertIfNotOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        registry.removeRegistrar(registrar1);
    }

    function test_SetDisputeBond_Success() public {
        vm.prank(owner);
        registry.setDisputeBond(50e6);
        assertEq(registry.disputeBond(), 50e6);
    }

    function test_SetDisputeBond_RevertIfNotOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        registry.setDisputeBond(50e6);
    }

    function test_SetTreasury_Success() public {
        address newTreasury = address(0x99);
        vm.prank(owner);
        registry.setTreasury(newTreasury);
        assertEq(registry.treasury(), newTreasury);
    }

    function test_SetTreasury_RevertIfZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert("zero address");
        registry.setTreasury(address(0));
    }

    // ==========================================
    // 3. REGISTRATION
    // ==========================================

    function test_RegisterLand_Success() public {
        vm.prank(registrar1);
        vm.expectEmit(true, false, false, true);
        emit LandRegistered(1, defaultPlotId, defaultDocHash, alice);

        uint256 id = registry.registerLand(
            defaultPlotId,
            defaultDocHash,
            alice,
            defaultDesc,
            defaultGeoCell
        );

        assertEq(id, 1);
        assertEq(registry.nextLandId(), 2);

        LandRegistry.LandRecord memory record = registry.getLand(1);
        assertEq(record.id, 1);
        assertEq(record.plotId, defaultPlotId);
        assertEq(record.docHash, defaultDocHash);
        assertEq(record.owner, alice);
        assertEq(record.registrar, registrar1);
        assertEq(record.description, defaultDesc);
        assertEq(record.geoCell, defaultGeoCell);
        assertEq(record.registeredAt, block.timestamp);
        assertEq(uint256(record.status), uint256(LandRegistry.LandStatus.Registered));
        assertEq(record.openDisputes, 0);

        // Check history initialization
        LandRegistry.Transfer[] memory history = registry.getHistory(1);
        assertEq(history.length, 1);
        assertEq(history[0].from, address(0));
        assertEq(history[0].to, alice);
        assertEq(history[0].newDocHash, defaultDocHash);
    }

    function test_RegisterLand_RevertIfNotRegistrar() public {
        vm.prank(alice);
        vm.expectRevert("not registrar");
        registry.registerLand(defaultPlotId, defaultDocHash, alice, defaultDesc, defaultGeoCell);
    }

    function test_RegisterLand_RevertIfEmptyPlotId() public {
        vm.prank(registrar1);
        vm.expectRevert("invalid plot");
        registry.registerLand("", defaultDocHash, alice, defaultDesc, defaultGeoCell);
    }

    function test_RegisterLand_RevertIfPlotIdTooLong() public {
        bytes memory longPlot = new bytes(121);
        for (uint256 i = 0; i < 121; i++) {
            longPlot[i] = "a";
        }
        vm.prank(registrar1);
        vm.expectRevert("invalid plot");
        registry.registerLand(string(longPlot), defaultDocHash, alice, defaultDesc, defaultGeoCell);
    }

    function test_RegisterLand_RevertIfDescriptionTooLong() public {
        bytes memory longDesc = new bytes(201);
        for (uint256 i = 0; i < 201; i++) {
            longDesc[i] = "b";
        }
        vm.prank(registrar1);
        vm.expectRevert("text too long");
        registry.registerLand(defaultPlotId, defaultDocHash, alice, string(longDesc), defaultGeoCell);
    }

    function test_RegisterLand_RevertIfGeoCellTooLong() public {
        bytes memory longGeo = new bytes(121);
        for (uint256 i = 0; i < 121; i++) {
            longGeo[i] = "c";
        }
        vm.prank(registrar1);
        vm.expectRevert("text too long");
        registry.registerLand(defaultPlotId, defaultDocHash, alice, defaultDesc, string(longGeo));
    }

    function test_RegisterLand_RevertIfZeroDocHash() public {
        vm.prank(registrar1);
        vm.expectRevert("invalid record");
        registry.registerLand(defaultPlotId, bytes32(0), alice, defaultDesc, defaultGeoCell);
    }

    function test_RegisterLand_RevertIfZeroOwner() public {
        vm.prank(registrar1);
        vm.expectRevert("invalid record");
        registry.registerLand(defaultPlotId, defaultDocHash, address(0), defaultDesc, defaultGeoCell);
    }

    function test_RegisterLand_RevertIfRegistrarIsOwner() public {
        vm.prank(registrar1);
        vm.expectRevert("invalid record");
        registry.registerLand(defaultPlotId, defaultDocHash, registrar1, defaultDesc, defaultGeoCell);
    }

    function test_RegisterLand_RevertIfDuplicateDocHash() public {
        vm.startPrank(registrar1);
        registry.registerLand(defaultPlotId, defaultDocHash, alice, defaultDesc, defaultGeoCell);

        vm.expectRevert("duplicate record");
        registry.registerLand("LAG-IKJ-9999", defaultDocHash, bob, defaultDesc, defaultGeoCell);
        vm.stopPrank();
    }

    function test_RegisterLand_RevertIfDuplicatePlotKey() public {
        vm.startPrank(registrar1);
        registry.registerLand(defaultPlotId, defaultDocHash, alice, defaultDesc, defaultGeoCell);

        bytes32 docHash2 = keccak256("Another Document");
        vm.expectRevert("duplicate record");
        registry.registerLand(defaultPlotId, docHash2, bob, defaultDesc, defaultGeoCell);
        vm.stopPrank();
    }

    // ==========================================
    // 4. VERIFY & GETBYPLOTID
    // ==========================================

    function test_Verify_NotFound() public view {
        (bool found, uint256 landId, LandRegistry.LandStatus status, address owner_, address registrar, uint64 registeredAt, uint32 openDisputes) = registry.verify(keccak256("nonexistent"));
        assertFalse(found);
        assertEq(landId, 0);
        assertEq(uint256(status), uint256(LandRegistry.LandStatus.Registered));
        assertEq(owner_, address(0));
        assertEq(registrar, address(0));
        assertEq(registeredAt, 0);
        assertEq(openDisputes, 0);
    }

    function test_Verify_Found() public {
        vm.prank(registrar1);
        registry.registerLand(defaultPlotId, defaultDocHash, alice, defaultDesc, defaultGeoCell);

        (bool found, uint256 landId, LandRegistry.LandStatus status, address owner_, address registrar, uint64 registeredAt, uint32 openDisputes) = registry.verify(defaultDocHash);
        assertTrue(found);
        assertEq(landId, 1);
        assertEq(uint256(status), uint256(LandRegistry.LandStatus.Registered));
        assertEq(owner_, alice);
        assertEq(registrar, registrar1);
        assertEq(registeredAt, block.timestamp);
        assertEq(openDisputes, 0);
    }

    function test_GetByPlotId_NotFound() public view {
        (bool found, uint256 landId, LandRegistry.LandStatus status, address owner_, address registrar, uint64 registeredAt, uint32 openDisputes) = registry.getByPlotId("UNKNOWN-PLOT");
        assertFalse(found);
        assertEq(landId, 0);
        assertEq(uint256(status), uint256(LandRegistry.LandStatus.Registered));
        assertEq(owner_, address(0));
        assertEq(registrar, address(0));
        assertEq(registeredAt, 0);
        assertEq(openDisputes, 0);
    }

    function test_GetByPlotId_Found() public {
        vm.prank(registrar1);
        registry.registerLand(defaultPlotId, defaultDocHash, alice, defaultDesc, defaultGeoCell);

        (bool found, uint256 landId, LandRegistry.LandStatus status, address owner_, address registrar, uint64 registeredAt, uint32 openDisputes) = registry.getByPlotId(defaultPlotId);
        assertTrue(found);
        assertEq(landId, 1);
        assertEq(uint256(status), uint256(LandRegistry.LandStatus.Registered));
        assertEq(owner_, alice);
        assertEq(registrar, registrar1);
        assertEq(registeredAt, block.timestamp);
        assertEq(openDisputes, 0);
    }

    // ==========================================
    // 5. DISPUTES
    // ==========================================

    function test_RaiseDispute_Success() public {
        vm.prank(registrar1);
        registry.registerLand(defaultPlotId, defaultDocHash, alice, defaultDesc, defaultGeoCell);

        bytes32 evidenceHash = keccak256("Forged Deed Evidence");
        string memory note = "Survey boundary overlap detected";

        vm.startPrank(bob);
        usdt.approve(address(registry), 10e6);
        vm.expectEmit(true, true, true, false);
        emit DisputeRaised(1, 1, bob);

        registry.raiseDispute(1, evidenceHash, note);
        vm.stopPrank();

        assertEq(usdt.balanceOf(address(registry)), 10e6);

        LandRegistry.LandRecord memory record = registry.getLand(1);
        assertEq(uint256(record.status), uint256(LandRegistry.LandStatus.Disputed));
        assertEq(record.openDisputes, 1);

        LandRegistry.Dispute[] memory disputes = registry.getDisputes(1);
        assertEq(disputes.length, 1);
        assertEq(disputes[0].id, 1);
        assertEq(disputes[0].landId, 1);
        assertEq(disputes[0].claimant, bob);
        assertEq(disputes[0].evidenceHash, evidenceHash);
        assertEq(disputes[0].note, note);
        assertEq(disputes[0].bond, 10e6);
        assertEq(disputes[0].raisedAt, block.timestamp);
        assertEq(uint256(disputes[0].status), uint256(LandRegistry.DisputeStatus.Open));
    }

    function test_RaiseDispute_RevertIfUnknownLand() public {
        vm.startPrank(bob);
        usdt.approve(address(registry), 10e6);
        vm.expectRevert("unknown land");
        registry.raiseDispute(999, keccak256("evidence"), "note");
        vm.stopPrank();
    }

    function test_RaiseDispute_RevertIfOwnerDisputes() public {
        vm.prank(registrar1);
        registry.registerLand(defaultPlotId, defaultDocHash, alice, defaultDesc, defaultGeoCell);

        vm.startPrank(alice);
        usdt.approve(address(registry), 10e6);
        vm.expectRevert("owner cannot dispute");
        registry.raiseDispute(1, keccak256("evidence"), "note");
        vm.stopPrank();
    }

    function test_RaiseDispute_RevertIfInvalidEvidence() public {
        vm.prank(registrar1);
        registry.registerLand(defaultPlotId, defaultDocHash, alice, defaultDesc, defaultGeoCell);

        vm.startPrank(bob);
        usdt.approve(address(registry), 10e6);

        // Zero evidence hash
        vm.expectRevert("invalid evidence");
        registry.raiseDispute(1, bytes32(0), "valid note");

        // Note too long (> 200 bytes)
        bytes memory longNote = new bytes(201);
        for (uint256 i = 0; i < 201; i++) {
            longNote[i] = "x";
        }
        vm.expectRevert("invalid evidence");
        registry.raiseDispute(1, keccak256("evidence"), string(longNote));
        vm.stopPrank();
    }

    function test_ResolveDispute_Upheld() public {
        vm.prank(registrar1);
        registry.registerLand(defaultPlotId, defaultDocHash, alice, defaultDesc, defaultGeoCell);

        vm.startPrank(bob);
        usdt.approve(address(registry), 10e6);
        registry.raiseDispute(1, keccak256("evidence"), "overlapping survey");
        vm.stopPrank();

        uint256 bobBalBefore = usdt.balanceOf(bob);

        // Conflict check: registrar1 who registered land cannot resolve
        vm.prank(registrar1);
        vm.expectRevert("conflict registrar");
        registry.resolveDispute(1, 0, true);

        // Non-registrar cannot resolve
        vm.prank(charlie);
        vm.expectRevert("not registrar");
        registry.resolveDispute(1, 0, true);

        // Registrar2 resolves and upholds dispute
        vm.startPrank(registrar2);
        vm.expectEmit(true, false, false, false);
        emit LandFrozen(1);
        vm.expectEmit(true, true, false, true);
        emit DisputeResolved(1, 1, true);

        registry.resolveDispute(1, 0, true);
        vm.stopPrank();

        // Claimant gets bond back
        assertEq(usdt.balanceOf(bob), bobBalBefore + 10e6);
        assertEq(usdt.balanceOf(address(registry)), 0);

        // Land status is Frozen
        LandRegistry.LandRecord memory record = registry.getLand(1);
        assertEq(uint256(record.status), uint256(LandRegistry.LandStatus.Frozen));
        assertEq(record.openDisputes, 0);

        LandRegistry.Dispute[] memory disputes = registry.getDisputes(1);
        assertEq(uint256(disputes[0].status), uint256(LandRegistry.DisputeStatus.Upheld));
    }

    function test_ResolveDispute_Rejected() public {
        vm.prank(registrar1);
        registry.registerLand(defaultPlotId, defaultDocHash, alice, defaultDesc, defaultGeoCell);

        vm.startPrank(bob);
        usdt.approve(address(registry), 10e6);
        registry.raiseDispute(1, keccak256("evidence"), "frivolous claim");
        vm.stopPrank();

        uint256 treasuryBalBefore = usdt.balanceOf(treasury);

        // Registrar2 rejects the dispute
        vm.prank(registrar2);
        vm.expectEmit(true, true, false, true);
        emit DisputeResolved(1, 1, false);
        registry.resolveDispute(1, 0, false);

        // Bond sent to treasury
        assertEq(usdt.balanceOf(treasury), treasuryBalBefore + 10e6);
        assertEq(usdt.balanceOf(address(registry)), 0);

        // Status reverts to Registered since 0 open disputes remain
        LandRegistry.LandRecord memory record = registry.getLand(1);
        assertEq(uint256(record.status), uint256(LandRegistry.LandStatus.Registered));
        assertEq(record.openDisputes, 0);

        LandRegistry.Dispute[] memory disputes = registry.getDisputes(1);
        assertEq(uint256(disputes[0].status), uint256(LandRegistry.DisputeStatus.Rejected));
    }

    function test_ResolveDispute_MultipleDisputes() public {
        vm.prank(registrar1);
        registry.registerLand(defaultPlotId, defaultDocHash, alice, defaultDesc, defaultGeoCell);

        // Bob raises dispute 1
        vm.startPrank(bob);
        usdt.approve(address(registry), 10e6);
        registry.raiseDispute(1, keccak256("ev1"), "note1");
        vm.stopPrank();

        // Charlie raises dispute 2
        vm.startPrank(charlie);
        usdt.approve(address(registry), 10e6);
        registry.raiseDispute(1, keccak256("ev2"), "note2");
        vm.stopPrank();

        LandRegistry.LandRecord memory rec = registry.getLand(1);
        assertEq(rec.openDisputes, 2);

        // Reject dispute 1 -> status should stay Disputed because 1 dispute is still open
        vm.prank(registrar2);
        registry.resolveDispute(1, 0, false);

        rec = registry.getLand(1);
        assertEq(rec.openDisputes, 1);
        assertEq(uint256(rec.status), uint256(LandRegistry.LandStatus.Disputed));

        // Re-resolving already resolved dispute reverts
        vm.prank(registrar2);
        vm.expectRevert("already resolved");
        registry.resolveDispute(1, 0, false);

        // Reject dispute 2 -> now openDisputes is 0, status returns to Registered
        vm.prank(registrar2);
        registry.resolveDispute(1, 1, false);

        rec = registry.getLand(1);
        assertEq(rec.openDisputes, 0);
        assertEq(uint256(rec.status), uint256(LandRegistry.LandStatus.Registered));
    }

    function test_ResolveDispute_RevertIfInvalidIndex() public {
        vm.prank(registrar1);
        registry.registerLand(defaultPlotId, defaultDocHash, alice, defaultDesc, defaultGeoCell);

        vm.prank(registrar2);
        vm.expectRevert("invalid dispute");
        registry.resolveDispute(1, 0, false);
    }

    // ==========================================
    // 6. UNFREEZE
    // ==========================================

    function test_Unfreeze_Success() public {
        vm.prank(registrar1);
        registry.registerLand(defaultPlotId, defaultDocHash, alice, defaultDesc, defaultGeoCell);

        vm.startPrank(bob);
        usdt.approve(address(registry), 10e6);
        registry.raiseDispute(1, keccak256("ev"), "claim");
        vm.stopPrank();

        // Registrar2 upholds dispute -> Land is Frozen, openDisputes = 0
        vm.prank(registrar2);
        registry.resolveDispute(1, 0, true);

        LandRegistry.LandRecord memory rec = registry.getLand(1);
        assertEq(uint256(rec.status), uint256(LandRegistry.LandStatus.Frozen));
        assertEq(rec.openDisputes, 0);

        // Unfreeze
        vm.prank(registrar1);
        vm.expectEmit(true, false, false, false);
        emit LandUnfrozen(1);
        registry.unfreeze(1);

        rec = registry.getLand(1);
        assertEq(uint256(rec.status), uint256(LandRegistry.LandStatus.Registered));
    }

    function test_Unfreeze_RevertIfNotFrozen() public {
        vm.prank(registrar1);
        registry.registerLand(defaultPlotId, defaultDocHash, alice, defaultDesc, defaultGeoCell);

        vm.prank(registrar1);
        vm.expectRevert("cannot unfreeze");
        registry.unfreeze(1);
    }

    function test_Unfreeze_RevertIfNotRegistrar() public {
        vm.prank(alice);
        vm.expectRevert("not registrar");
        registry.unfreeze(1);
    }

    // ==========================================
    // 7. TRANSFERS
    // ==========================================

    function test_TransferLifecycle_SuccessWithNewDocHash() public {
        vm.prank(registrar1);
        registry.registerLand(defaultPlotId, defaultDocHash, alice, defaultDesc, defaultGeoCell);

        bytes32 newDocHash = keccak256("Updated Deed of Assignment Bob");

        // Alice requests transfer to Bob
        vm.prank(alice);
        vm.expectEmit(true, true, false, false);
        emit TransferRequested(1, bob);
        registry.requestTransfer(1, bob, newDocHash);

        (address reqTo, bytes32 reqHash, bool reqPending) = registry.pendingTransfer(1);
        assertEq(reqTo, bob);
        assertEq(reqHash, newDocHash);
        assertTrue(reqPending);

        // Only the record's registrar (registrar1) can approve
        vm.prank(registrar2);
        vm.expectRevert("record registrar only");
        registry.approveTransfer(1);

        // Non-registrar cannot approve
        vm.prank(alice);
        vm.expectRevert("not registrar");
        registry.approveTransfer(1);

        // Registrar1 approves transfer
        vm.prank(registrar1);
        vm.expectEmit(true, true, true, false);
        emit TransferApproved(1, alice, bob);
        registry.approveTransfer(1);

        // Verify state updates
        LandRegistry.LandRecord memory rec = registry.getLand(1);
        assertEq(rec.owner, bob);
        assertEq(rec.docHash, newDocHash);

        // Old docHash lookup cleared, new docHash lookup points to land 1
        (bool oldFound,,,,,,) = registry.verify(defaultDocHash);
        assertFalse(oldFound);

        (bool newFound, uint256 newLandId,,,,,) = registry.verify(newDocHash);
        assertTrue(newFound);
        assertEq(newLandId, 1);

        // Pending request cleared
        (,, bool stillPending) = registry.pendingTransfer(1);
        assertFalse(stillPending);

        // History updated
        LandRegistry.Transfer[] memory history = registry.getHistory(1);
        assertEq(history.length, 2);
        assertEq(history[1].from, alice);
        assertEq(history[1].to, bob);
        assertEq(history[1].newDocHash, newDocHash);
    }

    function test_TransferLifecycle_SuccessWithoutNewDocHash() public {
        vm.prank(registrar1);
        registry.registerLand(defaultPlotId, defaultDocHash, alice, defaultDesc, defaultGeoCell);

        // Transfer with bytes32(0) newDocHash keeps existing docHash
        vm.prank(alice);
        registry.requestTransfer(1, bob, bytes32(0));

        vm.prank(registrar1);
        registry.approveTransfer(1);

        LandRegistry.LandRecord memory rec = registry.getLand(1);
        assertEq(rec.owner, bob);
        assertEq(rec.docHash, defaultDocHash);

        (bool found, uint256 landId,,,,,) = registry.verify(defaultDocHash);
        assertTrue(found);
        assertEq(landId, 1);
    }

    function test_Transfer_CancelByOwner() public {
        vm.prank(registrar1);
        registry.registerLand(defaultPlotId, defaultDocHash, alice, defaultDesc, defaultGeoCell);

        vm.prank(alice);
        registry.requestTransfer(1, bob, bytes32(0));

        // Non-owner cannot cancel
        vm.prank(bob);
        vm.expectRevert("not owner");
        registry.cancelTransfer(1);

        // Alice cancels
        vm.prank(alice);
        registry.cancelTransfer(1);

        (,, bool reqPending) = registry.pendingTransfer(1);
        assertFalse(reqPending);

        // Registrar cannot approve cancelled transfer
        vm.prank(registrar1);
        vm.expectRevert("transfer unavailable");
        registry.approveTransfer(1);
    }

    function test_Transfer_RevertIfDisputedOrFrozen() public {
        vm.prank(registrar1);
        registry.registerLand(defaultPlotId, defaultDocHash, alice, defaultDesc, defaultGeoCell);

        // Raise dispute
        vm.startPrank(bob);
        usdt.approve(address(registry), 10e6);
        registry.raiseDispute(1, keccak256("ev"), "dispute");
        vm.stopPrank();

        // Alice cannot request transfer when Disputed
        vm.prank(alice);
        vm.expectRevert("transfer unavailable");
        registry.requestTransfer(1, bob, bytes32(0));

        // Uphold dispute -> Frozen
        vm.prank(registrar2);
        registry.resolveDispute(1, 0, true);

        // Alice cannot request transfer when Frozen
        vm.prank(alice);
        vm.expectRevert("transfer unavailable");
        registry.requestTransfer(1, bob, bytes32(0));
    }

    function test_Transfer_RevertIfDuplicateNewDocHash() public {
        bytes32 docHash2 = keccak256("Plot 2 Document");
        vm.startPrank(registrar1);
        registry.registerLand(defaultPlotId, defaultDocHash, alice, defaultDesc, defaultGeoCell);
        registry.registerLand("LAG-IKJ-0422", docHash2, charlie, defaultDesc, defaultGeoCell);
        vm.stopPrank();

        // Alice requests transfer using docHash2 (which belongs to plot 2)
        vm.prank(alice);
        registry.requestTransfer(1, bob, docHash2);

        // Approval should revert due to duplicate document
        vm.prank(registrar1);
        vm.expectRevert("duplicate document");
        registry.approveTransfer(1);
    }

    function test_Transfer_RevertIfZeroAddressRecipient() public {
        vm.prank(registrar1);
        registry.registerLand(defaultPlotId, defaultDocHash, alice, defaultDesc, defaultGeoCell);

        vm.prank(alice);
        vm.expectRevert("transfer unavailable");
        registry.requestTransfer(1, address(0), bytes32(0));
    }

    // ==========================================
    // 8. FUZZ TESTING: BOND CONSERVATION INVARIANT
    // ==========================================

    /// @notice PRD Section 9: Bond conservation fuzz: contract USDT balance equals sum of unresolved bonds.
    function testFuzz_BondConservation(uint8 numDisputesRaw, uint8 resolveCountRaw, bool upheld) public {
        // Bound disputes between 1 and 15 for fuzz runs
        uint256 numDisputes = bound(uint256(numDisputesRaw), 1, 15);
        uint256 resolveCount = bound(uint256(resolveCountRaw), 0, numDisputes);

        vm.prank(registrar1);
        registry.registerLand(defaultPlotId, defaultDocHash, alice, defaultDesc, defaultGeoCell);

        uint256 bondAmount = registry.disputeBond();

        // Raise disputes from dynamically generated claimant addresses
        for (uint256 i = 0; i < numDisputes; i++) {
            address claimant = address(uint160(0x9000 + i));
            usdt.mint(claimant, bondAmount);

            vm.startPrank(claimant);
            usdt.approve(address(registry), bondAmount);
            bytes32 evidenceHash = keccak256(abi.encodePacked("Evidence", i));
            registry.raiseDispute(1, evidenceHash, "Contested ownership claim");
            vm.stopPrank();

            // Invariant check during dispute raising
            LandRegistry.LandRecord memory recordDuring = registry.getLand(1);
            assertEq(
                usdt.balanceOf(address(registry)),
                uint256(recordDuring.openDisputes) * bondAmount,
                "Invariant violated during raiseDispute"
            );
        }

        // Registrar2 resolves a subset of disputes
        for (uint256 j = 0; j < resolveCount; j++) {
            vm.prank(registrar2);
            registry.resolveDispute(1, j, upheld);

            // Invariant check during dispute resolution
            LandRegistry.LandRecord memory recordAfterResolve = registry.getLand(1);
            assertEq(
                usdt.balanceOf(address(registry)),
                uint256(recordAfterResolve.openDisputes) * bondAmount,
                "Invariant violated during resolveDispute"
            );
        }
    }
}
