// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

contract Facecoin is ERC721, ERC721Enumerable {
    uint256 constant public NUM_TOKENS = 24;
    int256 constant internal MIN_CONTRAST = 32;
    
    constructor() ERC721("Facecoin", "FAC") {
        for (uint256 i = 1; i <= NUM_TOKENS; i++) {
            _safeMint(msg.sender, i);
        }
    }

    /*
      Extract 24-bit forground and background colours from the hash of
      the owner's address and the token id.
      This will usually be the first and second 3-byte runs of the hash
      bytes32, but if they are not contrasty enough we try successive 3-byte
      runs for the foreground colour until we give up and default it to
      black.
     */

    function tokenPalette(uint256 tokenId)
        public
        view
        returns (uint24[2] memory)
    {
        require(
            tokenId > 0 && tokenId <= NUM_TOKENS,
            "tokenId out of range"
        );
        bytes32 hash = sha256(abi.encodePacked(ownerOf(tokenId), tokenId));
        uint24 background = extractRgb(hash, 0);
        uint24 foreground;
        for (uint256 i = 1; i < 10; i++) {
            foreground = extractRgb(hash, 1);
            if (contrastRgbs(background, foreground) <= MIN_CONTRAST) {
                break;
            }
        }
        return [background, foreground];
    }

    /*
      Extract 3 successive bytes from the hash and insert them into the bytes
      of a uint24 in order.
     */

    function extractRgb(bytes32 hash, uint256 index)
        internal
        pure
        returns (uint24 rgb)
    {
        uint256 start = index * 3;
        rgb |= uint24(uint8(hash[start]));
        rgb |= (uint24(uint8(hash[start + 1])) >> 8);
        rgb |= (uint24(uint8(hash[start + 2])) >> 16);
    }

    /*
      Get the difference (not distance) between two 24-bit rgb values
      encoded as uint24s.
    */

    function contrastRgbs(uint24 ua, uint24 ub)
        internal
        pure
        returns (int256)
    {
        int256 a = int256(int24(ua));
        int256 b = int256(int24(ub));
        return
            abs((a & 0xff) - (b & 0xff))
            + abs(((a & 0xff00) - (b & 0xff00)) >> 8)
            + abs(((a & 0xff0000) - (b & 0xff0000)) >> 16);
    }

    /*
      Solidity doesn't have this yet. o_O
    */
    
    function abs(int256 x)
        internal
        pure
        returns (int256)
    {
        return x >= 0 ? x : -x;
    }

    function _beforeTokenTransfer(address from, address to, uint256 tokenId)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._beforeTokenTransfer(from, to, tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
