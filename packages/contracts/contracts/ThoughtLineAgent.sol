// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ThoughtLineAgent is ERC721, ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;

    mapping(address => bool) public minters;

    struct Lineage {
        uint256 parentA;
        uint256 parentB;
        bool hasParents;
    }

    mapping(uint256 => Lineage) public lineage;

    event AgentMinted(
        uint256 indexed tokenId,
        address indexed owner,
        bool hasParents,
        uint256 parentA,
        uint256 parentB
    );

    modifier onlyMinter() {
        require(minters[msg.sender], "Not authorized to mint");
        _;
    }

    constructor() ERC721("ThoughtLine Agent", "TLINE") Ownable(msg.sender) {
        minters[msg.sender] = true;
    }

    function setMinter(address account, bool authorized) external onlyOwner {
        minters[account] = authorized;
    }

    function mintGenesis(
        address to,
        string memory uri
    ) external onlyMinter returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        emit AgentMinted(tokenId, to, false, 0, 0);
        return tokenId;
    }

    function mintChild(
        address to,
        string memory uri,
        uint256 parentA,
        uint256 parentB
    ) external onlyMinter returns (uint256) {
        require(ownerOf(parentA) == to, "Must own parent A");
        require(ownerOf(parentB) == to, "Must own parent B");
        require(parentA != parentB, "Parents must be different");

        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        lineage[tokenId] = Lineage(parentA, parentB, true);
        emit AgentMinted(tokenId, to, true, parentA, parentB);
        return tokenId;
    }

    function getLineage(
        uint256 tokenId
    ) external view returns (bool hasParents, uint256 parentA, uint256 parentB) {
        Lineage memory l = lineage[tokenId];
        return (l.hasParents, l.parentA, l.parentB);
    }

    // Required overrides
    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
