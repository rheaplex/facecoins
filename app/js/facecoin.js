//    facecoin.js - Face recognition in hash bitmaps as aesthetic proof of work.
//    Copyright (C) 2014, 2020 Rhea Myers <rhea@myers.studio>
//    Copyright (C) 2023 Myers Studio Ltd.
//
//    This program is free software: you can redistribute it and/or modify
//    it under the terms of the GNU General Public License as published by
//    the Free Software Foundation, either version 3 of the License, or
//    (at your option) any later version.
//
//    This program is distributed in the hope that it will be useful,
//    but WITHOUT ANY WARRANTY; without even the implied warranty of
//    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//    GNU General Public License for more details.
//
//    You should have received a copy of the GNU General Public License
//    along with this program.  If not, see <http://www.gnu.org/licenses/>.

/* global cascade ccv stackBlurCanvasRGB */

////////////////////////////////////////////////////////////////////////////////
// Configuration
////////////////////////////////////////////////////////////////////////////////

const bitmap_size = 16;
const canvas_size = 256;
const canvas_scale = canvas_size / bitmap_size;
const blur_radius = 5;
const match_line_width = 1;
const half_match_line_width = match_line_width / 2;
const extra_text_height = 234;
const truncate_blocks_at = 128;

const NUM_TOKENS = 16;
const DEFAULT_TOKEN_ID = 1;

////////////////////////////////////////////////////////////////////////////////
// Globals
////////////////////////////////////////////////////////////////////////////////

// Should encapsulate

let ui;
let matches;
let tries;
let digest;
let previousDigest;

let tokenId;
let startBlockNumber;

let foregroundColour;
let backgroundColour;
let blurredFaceCanvas;

////////////////////////////////////////////////////////////////////////////////
// Create UI for each block
////////////////////////////////////////////////////////////////////////////////

const createSection = where => {
    const figure = document.createElement("span");
  figure.classList.add("page-grid-cell");
  // This is so the first cell isn't shorter than the others
  figure.style.height = canvas_size + extra_text_height;
  const canvas = document.createElement("canvas");
  canvas.width = canvas_size;
  canvas.height = canvas_size;
  const caption = document.createElement("p");
  caption.style["overflow-wrap"] = "break-word";
  caption.style.width = canvas_size;
  figure.append(canvas);
  figure.append(caption);
  document.getElementById(where).append(figure);
  return {
    figure: figure,
    canvas: canvas,
    caption: caption,
    ctx: canvas.getContext("2d")
  };
};

////////////////////////////////////////////////////////////////////////////////
// The digest
////////////////////////////////////////////////////////////////////////////////

const sha256Hex = async data => Array.from(
  new Uint8Array(
    await crypto.subtle.digest("SHA-256",
                               new TextEncoder().encode(data))
  )).map((bytes) => bytes.toString(16).padStart(2, "0"))
      .join("");

const newDigest = async () => {
  const digest = await sha256Hex(previousDigest + tries);
  // Ensure the first and subsequent layouts line up
  const prev = previousDigest ? previousDigest : "None<br /><br />" ;
  ui.caption.innerHTML = "<b>Previous&nbsp;Digest:</b>&nbsp;" + prev +
    "&nbsp;<br /><b>Proof-of-Work Nonce:</b>&nbsp;" + tries.toString(16) +
    "<br /><b>Proof&#8209;of&#8209;Work&nbsp;Hash:</b>&nbsp;" + digest;
  return digest;
};

////////////////////////////////////////////////////////////////////////////////
// Drawing the digest as a bitmap
////////////////////////////////////////////////////////////////////////////////

/*const lerpColour = (value, foreground, background) => {
  const r = background[0] + ((foreground[0] / 255.0) * value);
  const g = background[1] + ((foreground[1] / 255.0) * value);
  const b = background[2] + ((foreground[2] / 255.0) * value);
};

const pixelValue8Bit = (x, y, bitmap_width, digest , foreground, background)
      =>
{
  var index = x + (y * bitmap_width);
  var grey = parseInt(digest[index], 16) * 16;
  return grey;
};*/

const pixelValue = (x, y, bitmap_width, digest, foreground, background) => {
  const byte_index = Math.floor((x + (y * bitmap_width)) / 4);
  const bit_index = (x + (y * bitmap_width)) % 4;
  let colour;
  if (((parseInt(digest[byte_index], 16) >> bit_index) & 0x01) == 0) {
    colour = foreground;
  } else {
    colour = background;
  }
  return colour;
};

const drawFace = (ctx, digest, foreground, background) => {
   for(let y = 0; y < bitmap_size; y++) {
    for (let x = 0; x < bitmap_size; x++) {
      ctx.fillStyle = pixelValue(
        x, y, bitmap_size, digest, foreground, background
      );
      // Slower than other alternatives, but clear
      ctx.fillRect(x * canvas_scale, y * canvas_scale,
                      canvas_scale, canvas_scale);
    }
  }
};

const drawFaceMonoBlurred = (offscreenCtx, digest) => {
  drawFace(offscreenCtx, digest, "black", "white");
  stackBlurCanvasRGB(offscreenCtx, 0, 0, canvas_size, canvas_size, blur_radius);
};

////////////////////////////////////////////////////////////////////////////////
// Detecting the face in the digest bitmap
////////////////////////////////////////////////////////////////////////////////

const detectFace = canvas => {
  const matches = ccv.detect_objects(
    { "canvas" : ccv.grayscale(ccv.pre(canvas)),
      "cascade" : cascade,
      "interval" : 5,
      "min_neighbors" : 1 });
  return matches;
};

const drawMatches = (ui, matches) => {
  // Just draw the first one
  // In testing, multiples were overlapping matches of the same feature
  const match = matches[0];
  //matches.forEach(function(match) {
  // Un-clamped values, for comparison
  /*console.log(match);
  ui.ctx.lineWidth = match_line_width;
  ui.ctx.strokeStyle = "rgb(0, 0, 255)";
  // Inset the box, especially for bitmap edges so lines are always same width
  ui.ctx.rect(
    match.x,
    match.y,
    match.width,
    match.height
  );*/
  // Clamp to bitmap pixel boundaries
  const x = Math.round(match.x / canvas_scale);
  const y = Math.round(match.y / canvas_scale);
  const width = Math.round(match.width / canvas_scale);
  const height = Math.round(match.height / canvas_scale);
  ui.ctx.shadowColor = "#fff";
  ui.ctx.shadowBlur = 4;
  ui.ctx.lineWidth = match_line_width;
  ui.ctx.strokeStyle = "#000";
  // Inset the box, especially for bitmap edges so lines are always same width
  ui.ctx.rect(
    (x  * canvas_scale) + half_match_line_width,
    (y * canvas_scale) + half_match_line_width,
    (width * canvas_scale) - half_match_line_width,
    (height * canvas_scale) - half_match_line_width
  );
  ui.ctx.stroke();
  // LTRB "litterbug" order co-ordinates (makes sense for top left 0, 0)
  ui.caption.innerHTML +=
    `<br /><b>Face:</b>&nbsp; ${x}, ${y}, ${x + width}, ${y + height}`;
  //});
};

///////////////////////////////////////////////////////////////////////////////
// Token ID
///////////////////////////////////////////////////////////////////////////////

const maybeSetTokenFromHash = () => {
  const id = window.location.hash.substr(1);
  if (id > 0 && id <= NUM_TOKENS) {
    tokenId = id;
  } else {
    // Reload the page with a working token id
    window.location.hash = DEFAULT_TOKEN_ID;
  }
};

///////////////////////////////////////////////////////////////////////////////
// Network
///////////////////////////////////////////////////////////////////////////////

let facecoinContract;
let provider;

const initNetwork = async () => {
  provider = new ethers.providers.Web3Provider(window.ethereum);
  // Just reload the window if the network changes
  provider.on("chainChanged", () => { window.location.reload(); });
  const facecoinJson = await ethers.utils.fetchJson(
    "./js/Facecoin.json"
  );
  facecoinContract = new ethers.Contract(
    facecoinJson.networks[(await provider.getNetwork()).chainId].address,
    facecoinJson.abi,
    provider
  );
  const transfer = facecoinContract.filters.Transfer(
    null,
    null,
    ethers.BigNumber.from(tokenId)
  );
  startBlockNumber = await provider.getBlockNumber();
  facecoinContract.on(transfer, onFacecoinTransfer);
};

const onFacecoinTransfer = async (from, to, id, ...rest) => {
  // Ignore a transfer that happens in the current block.
  const event = rest[rest.length - 1];
  if(event.blockNumber <= startBlockNumber) {
    return;
  }
  await updateState();
  nextBlock();
};

const updateState = async () => {
  const palette = await facecoinContract
        .tokenPalette(ethers.BigNumber.from(tokenId));
  backgroundColour = `rgb(${palette[0].join(",")})`;
  foregroundColour = `rgb(${palette[1].join(",")})`;
  matches = false;
  tries = 0;
  previousDigest = await facecoinContract
    .ownerOf(ethers.BigNumber.from(tokenId));
  digest = null;
};

////////////////////////////////////////////////////////////////////////////////
// Main flow of execution
////////////////////////////////////////////////////////////////////////////////

const nextBlock = () => {
  // Don't add too many elements to the page, we don't want to hog memory
  const elements = document.getElementsByClassName("page-grid-cell");
  while (elements.length >= truncate_blocks_at) {
    const element = elements[0];
    element.parentNode.removeChild(element);
  }
  // Set up the state for the new block
  matches = Array();
  tries = 0;
  // Create the ui section for the new block
  ui = createSection("blocks");
  document.body.animate({scrollTop: document.height}, 1000);
  // And do the work
  animationLoop();
};

const animationLoop = async () => {
  if (matches.length == 0) {
    window.requestAnimationFrame(animationLoop);
    tries = tries + 1;
    digest = await newDigest();
    drawFace(ui.ctx, digest, foregroundColour, backgroundColour);
    drawFaceMonoBlurred(blurredFaceCanvas.getContext("2d"), digest);
    matches = detectFace(blurredFaceCanvas);
  } else {
    drawMatches(ui, matches);
    previousDigest = digest;
    nextBlock();
  }
};

window.addEventListener("DOMContentLoaded", async () => {
  maybeSetTokenFromHash();

  blurredFaceCanvas = document.createElement("canvas");
  blurredFaceCanvas.width = canvas_size;
  blurredFaceCanvas.height = canvas_size;

  await initNetwork();
  await updateState();
  
  nextBlock();
});
