// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
enum OracleType {
    TEE,
    ZKP
}

struct AccessProof {
    bytes32 oldDataHash;
    bytes32 newDataHash;
    bytes nonce;
    bytes encryptedPubKey;
    bytes proof;
}

struct OwnershipProof {
    OracleType oracleType;
    bytes32 oldDataHash;
    bytes32 newDataHash;
    bytes sealedKey;
    bytes encryptedPubKey;
    bytes nonce;
    bytes proof;
}

struct TransferValidityProof {
    AccessProof accessProof;
    OwnershipProof ownershipProof;
}

struct TransferValidityProofOutput {
    bytes32 oldDataHash;
    bytes32 newDataHash;
    bytes sealedKey;
    bytes encryptedPubKey;
    bytes wantedKey;
    address accessAssistant;
    bytes accessProofNonce;
    bytes ownershipProofNonce;
}

struct IntelligentData {
    string dataDescription;
    bytes32 dataHash;
}

interface IERC7857DataVerifier {
    function verifyTransferValidity(
        TransferValidityProof[] calldata proofs
    ) external returns (TransferValidityProofOutput[] memory);
}

interface IERC7857Metadata {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function intelligentDataOf(uint256 tokenId) external view returns (IntelligentData[] memory);
}

interface IERC7857 {
    event Authorization(address indexed from, address indexed to, uint256 indexed tokenId);
    event AuthorizationRevoked(address indexed from, address indexed to, uint256 indexed tokenId);
    event Transferred(uint256 tokenId, address indexed from, address indexed to);
    event Cloned(uint256 indexed tokenId, uint256 indexed newTokenId, address from, address to);
    event PublishedSealedKey(address indexed to, uint256 indexed tokenId, bytes[] sealedKeys);
    event DelegateAccess(address indexed user, address indexed assistant);

    function verifier() external view returns (IERC7857DataVerifier);
    function iTransfer(
        address to,
        uint256 tokenId,
        TransferValidityProof[] calldata proofs
    ) external;
    function iClone(
        address to,
        uint256 tokenId,
        TransferValidityProof[] calldata proofs
    ) external returns (uint256 newTokenId);
    function authorizeUsage(uint256 tokenId, address user) external;
    function revokeAuthorization(uint256 tokenId, address user) external;
    function authorizedUsersOf(uint256 tokenId) external view returns (address[] memory);
    function delegateAccess(address assistant) external;
    function getDelegateAccess(address user) external view returns (address);
}

contract TEEVerifier is Ownable, IERC7857DataVerifier {
    address public signer;

    event SignerUpdated(address indexed signer);

    constructor(address initialSigner) Ownable(msg.sender) {
        signer = initialSigner;
    }

    function setSigner(address newSigner) external onlyOwner {
        signer = newSigner;
        emit SignerUpdated(newSigner);
    }

    function verifyTransferValidity(
        TransferValidityProof[] calldata proofs
    ) external pure returns (TransferValidityProofOutput[] memory outputs) {
        outputs = new TransferValidityProofOutput[](proofs.length);

        for (uint256 i = 0; i < proofs.length; i++) {
            require(
                proofs[i].accessProof.oldDataHash == proofs[i].ownershipProof.oldDataHash,
                "Invalid old data hash"
            );
            require(
                proofs[i].accessProof.newDataHash == proofs[i].ownershipProof.newDataHash,
                "Invalid new data hash"
            );

            outputs[i] = TransferValidityProofOutput({
                oldDataHash: proofs[i].accessProof.oldDataHash,
                newDataHash: proofs[i].accessProof.newDataHash,
                sealedKey: proofs[i].ownershipProof.sealedKey,
                encryptedPubKey: proofs[i].ownershipProof.encryptedPubKey,
                wantedKey: proofs[i].accessProof.encryptedPubKey,
                accessAssistant: address(0),
                accessProofNonce: proofs[i].accessProof.nonce,
                ownershipProofNonce: proofs[i].ownershipProof.nonce
            });
        }
    }
}

contract ThoughtLineAgent is ERC721, ERC721URIStorage, Ownable, IERC7857, IERC7857Metadata {
    uint256 private _nextTokenId;

    struct Lineage {
        uint256 parentA;
        uint256 parentB;
        bool hasParents;
    }

    IERC7857DataVerifier public immutable verifier;
    mapping(uint256 => IntelligentData[]) private _intelligentData;
    mapping(uint256 => address[]) private _authorizedUsers;
    mapping(uint256 => mapping(address => bool)) private _isAuthorizedUser;
    mapping(uint256 => address[]) private _authorizedBreeders;
    mapping(uint256 => mapping(address => bool)) private _isAuthorizedBreeder;
    mapping(uint256 => uint256) public usageFee;
    mapping(uint256 => uint256) public breedingFee;
    mapping(address => address) private _delegateAccess;
    mapping(uint256 => Lineage) public lineage;

    event AgentMinted(
        uint256 indexed tokenId,
        address indexed owner,
        string publicProfileURI,
        string privateWorldviewURI,
        bytes32 dataHash,
        bool hasParents,
        uint256 parentA,
        uint256 parentB
    );
    event UsageFeeSet(uint256 indexed tokenId, uint256 fee);
    event BreedingFeeSet(uint256 indexed tokenId, uint256 fee);
    event BreedingAuthorization(address indexed from, address indexed to, uint256 indexed tokenId);
    event BreedingAuthorizationRevoked(address indexed from, address indexed to, uint256 indexed tokenId);
    event UsageFeePaid(uint256 indexed tokenId, address indexed payer, address indexed owner, uint256 amount);
    event BreedingFeePaid(uint256 indexed tokenId, address indexed payer, address indexed owner, uint256 amount);

    constructor(address verifierAddress) ERC721("ThoughtLine Agent", "TLINE") Ownable(msg.sender) {
        verifier = IERC7857DataVerifier(verifierAddress);
    }

    function mintGenesis(
        string memory publicProfileURI_,
        string memory privateWorldviewURI_,
        bytes32 dataHash_
    ) external returns (uint256) {
        uint256 tokenId = _mintAgent(
            msg.sender,
            publicProfileURI_,
            privateWorldviewURI_,
            dataHash_
        );

        emit AgentMinted(
            tokenId,
            msg.sender,
            publicProfileURI_,
            privateWorldviewURI_,
            dataHash_,
            false,
            0,
            0
        );

        return tokenId;
    }

    function mintChild(
        string memory publicProfileURI_,
        string memory privateWorldviewURI_,
        bytes32 dataHash_,
        uint256 parentA,
        uint256 parentB
    ) external returns (uint256) {
        require(parentA != parentB, "Parents must be different");
        require(_ownerOf(parentA) != address(0), "Parent A does not exist");
        require(_ownerOf(parentB) != address(0), "Parent B does not exist");

        uint256 tokenId = _mintAgent(
            msg.sender,
            publicProfileURI_,
            privateWorldviewURI_,
            dataHash_
        );

        lineage[tokenId] = Lineage(parentA, parentB, true);

        emit AgentMinted(
            tokenId,
            msg.sender,
            publicProfileURI_,
            privateWorldviewURI_,
            dataHash_,
            true,
            parentA,
            parentB
        );

        return tokenId;
    }

    function privateWorldviewURI(uint256 tokenId) external view returns (string memory) {
        _requireOwned(tokenId);
        return _intelligentData[tokenId][0].dataDescription;
    }

    function dataHash(uint256 tokenId) external view returns (bytes32) {
        _requireOwned(tokenId);
        return _intelligentData[tokenId][0].dataHash;
    }

    function intelligentDataOf(
        uint256 tokenId
    ) external view returns (IntelligentData[] memory) {
        _requireOwned(tokenId);
        return _intelligentData[tokenId];
    }

    function iTransfer(
        address to,
        uint256 tokenId,
        TransferValidityProof[] calldata proofs
    ) external {
        address from = ownerOf(tokenId);
        require(_isAuthorizedOrOwner(msg.sender, tokenId), "Not authorized");
        TransferValidityProofOutput[] memory outputs = verifier.verifyTransferValidity(proofs);
        require(outputs.length > 0, "Proof required");

        _intelligentData[tokenId][0].dataHash = outputs[0].newDataHash;
        _safeTransfer(from, to, tokenId);
        emit Transferred(tokenId, from, to);
        _publishSealedKeys(to, tokenId, outputs);
    }

    function iClone(
        address to,
        uint256 tokenId,
        TransferValidityProof[] calldata proofs
    ) external returns (uint256 newTokenId) {
        address from = ownerOf(tokenId);
        require(_isAuthorizedOrOwner(msg.sender, tokenId), "Not authorized");
        TransferValidityProofOutput[] memory outputs = verifier.verifyTransferValidity(proofs);
        require(outputs.length > 0, "Proof required");

        newTokenId = _mintAgent(
            to,
            tokenURI(tokenId),
            _intelligentData[tokenId][0].dataDescription,
            outputs[0].newDataHash
        );

        emit Cloned(tokenId, newTokenId, from, to);
        _publishSealedKeys(to, newTokenId, outputs);
    }

    function authorizeUsage(uint256 tokenId, address user) external {
        require(ownerOf(tokenId) == msg.sender, "Not token owner");
        require(user != address(0), "Invalid user");
        _authorizeUsage(tokenId, msg.sender, user);
    }

    function revokeAuthorization(uint256 tokenId, address user) external {
        require(ownerOf(tokenId) == msg.sender, "Not token owner");

        if (_isAuthorizedUser[tokenId][user]) {
            _isAuthorizedUser[tokenId][user] = false;
            _removeAuthorizedUser(tokenId, user);
            emit AuthorizationRevoked(msg.sender, user, tokenId);
        }
    }

    function authorizedUsersOf(uint256 tokenId) external view returns (address[] memory) {
        _requireOwned(tokenId);
        return _authorizedUsers[tokenId];
    }

    function isAuthorizedUser(uint256 tokenId, address user) external view returns (bool) {
        _requireOwned(tokenId);
        return ownerOf(tokenId) == user || _isAuthorizedUser[tokenId][user];
    }

    function setUsageFee(uint256 tokenId, uint256 fee) external {
        require(ownerOf(tokenId) == msg.sender, "Not token owner");
        usageFee[tokenId] = fee;
        emit UsageFeeSet(tokenId, fee);
    }

    function payForUsage(uint256 tokenId) external payable {
        address tokenOwner = ownerOf(tokenId);
        uint256 fee = usageFee[tokenId];
        require(fee > 0, "Usage fee not set");
        require(msg.value == fee, "Incorrect usage fee");

        _authorizeUsage(tokenId, tokenOwner, msg.sender);
        (bool sent, ) = payable(tokenOwner).call{value: msg.value}("");
        require(sent, "Usage fee transfer failed");
        emit UsageFeePaid(tokenId, msg.sender, tokenOwner, msg.value);
    }

    function authorizeBreeding(uint256 tokenId, address user) external {
        require(ownerOf(tokenId) == msg.sender, "Not token owner");
        require(user != address(0), "Invalid user");
        _authorizeBreeding(tokenId, msg.sender, user);
    }

    function revokeBreedingAuthorization(uint256 tokenId, address user) external {
        require(ownerOf(tokenId) == msg.sender, "Not token owner");

        if (_isAuthorizedBreeder[tokenId][user]) {
            _isAuthorizedBreeder[tokenId][user] = false;
            _removeAuthorizedBreeder(tokenId, user);
            emit BreedingAuthorizationRevoked(msg.sender, user, tokenId);
        }
    }

    function authorizedBreedersOf(uint256 tokenId) external view returns (address[] memory) {
        _requireOwned(tokenId);
        return _authorizedBreeders[tokenId];
    }

    function isAuthorizedBreeder(uint256 tokenId, address user) external view returns (bool) {
        _requireOwned(tokenId);
        return ownerOf(tokenId) == user || _isAuthorizedBreeder[tokenId][user];
    }

    function setBreedingFee(uint256 tokenId, uint256 fee) external {
        require(ownerOf(tokenId) == msg.sender, "Not token owner");
        breedingFee[tokenId] = fee;
        emit BreedingFeeSet(tokenId, fee);
    }

    function payForBreeding(uint256 tokenId) external payable {
        address tokenOwner = ownerOf(tokenId);
        uint256 fee = breedingFee[tokenId];
        require(fee > 0, "Breeding fee not set");
        require(msg.value == fee, "Incorrect breeding fee");

        _authorizeBreeding(tokenId, tokenOwner, msg.sender);
        (bool sent, ) = payable(tokenOwner).call{value: msg.value}("");
        require(sent, "Breeding fee transfer failed");
        emit BreedingFeePaid(tokenId, msg.sender, tokenOwner, msg.value);
    }

    function delegateAccess(address assistant) external {
        _delegateAccess[msg.sender] = assistant;
        emit DelegateAccess(msg.sender, assistant);
    }

    function getDelegateAccess(address user) external view returns (address) {
        return _delegateAccess[user];
    }

    function getLineage(
        uint256 tokenId
    ) external view returns (bool hasParents, uint256 parentA, uint256 parentB) {
        _requireOwned(tokenId);
        Lineage memory l = lineage[tokenId];
        return (l.hasParents, l.parentA, l.parentB);
    }

    function _mintAgent(
        address to,
        string memory publicProfileURI_,
        string memory privateWorldviewURI_,
        bytes32 dataHash_
    ) private returns (uint256) {
        require(bytes(publicProfileURI_).length > 0, "Public profile URI required");
        require(bytes(privateWorldviewURI_).length > 0, "Private worldview URI required");
        require(dataHash_ != bytes32(0), "Data hash required");

        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, publicProfileURI_);
        _intelligentData[tokenId].push(IntelligentData(privateWorldviewURI_, dataHash_));
        return tokenId;
    }

    function _isAuthorizedOrOwner(address spender, uint256 tokenId) private view returns (bool) {
        address tokenOwner = ownerOf(tokenId);
        return
            spender == tokenOwner ||
            getApproved(tokenId) == spender ||
            isApprovedForAll(tokenOwner, spender);
    }

    function _authorizeUsage(uint256 tokenId, address from, address user) private {
        if (!_isAuthorizedUser[tokenId][user]) {
            _isAuthorizedUser[tokenId][user] = true;
            _authorizedUsers[tokenId].push(user);
            emit Authorization(from, user, tokenId);
        }
    }

    function _authorizeBreeding(uint256 tokenId, address from, address user) private {
        if (!_isAuthorizedBreeder[tokenId][user]) {
            _isAuthorizedBreeder[tokenId][user] = true;
            _authorizedBreeders[tokenId].push(user);
            emit BreedingAuthorization(from, user, tokenId);
        }
    }

    function _removeAuthorizedUser(uint256 tokenId, address user) private {
        address[] storage users = _authorizedUsers[tokenId];
        for (uint256 i = 0; i < users.length; i++) {
            if (users[i] == user) {
                users[i] = users[users.length - 1];
                users.pop();
                return;
            }
        }
    }

    function _removeAuthorizedBreeder(uint256 tokenId, address user) private {
        address[] storage users = _authorizedBreeders[tokenId];
        for (uint256 i = 0; i < users.length; i++) {
            if (users[i] == user) {
                users[i] = users[users.length - 1];
                users.pop();
                return;
            }
        }
    }

    function _publishSealedKeys(
        address to,
        uint256 tokenId,
        TransferValidityProofOutput[] memory outputs
    ) private {
        bytes[] memory sealedKeys = new bytes[](outputs.length);
        for (uint256 i = 0; i < outputs.length; i++) {
            sealedKeys[i] = outputs[i].sealedKey;
        }
        emit PublishedSealedKey(to, tokenId, sealedKeys);
    }

    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function name() public view override(ERC721, IERC7857Metadata) returns (string memory) {
        return super.name();
    }

    function symbol() public view override(ERC721, IERC7857Metadata) returns (string memory) {
        return super.symbol();
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return
            interfaceId == type(IERC7857).interfaceId ||
            interfaceId == type(IERC7857Metadata).interfaceId ||
            super.supportsInterface(interfaceId);
    }
}
