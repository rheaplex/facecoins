//    facecoin.js - Face recognition in hashes as aesthetic proof of work.
//    Copyright (C) 2014,2018,2022 Rhea Myers <rhea@myers.studio>
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

/* global localStorage requestAnimFrame URL */
/* global CCVLib stackBlurCanvasRGB */

import { ethers } from "./ethers.js";

///////////////////////////////////////////////////////////////////////////////
// Configuration
///////////////////////////////////////////////////////////////////////////////

const digest_size = 64;
const bitmap_size = 8;
const canvas_size = 256;
const canvas_scale = canvas_size / bitmap_size;
const blur_radius = 10; // 32
const match_line_width = 2;
const extra_text_height = 234;
const truncate_blocks_at = 128;
const NUM_TOKENS = 16;
const DEFAULT_TOKEN_ID = 1;

///////////////////////////////////////////////////////////////////////////////
// Globals
///////////////////////////////////////////////////////////////////////////////

// Should encapsulate

let ui;

let tokenId;

let ccv;
let cascade;

let offscreen;
let offscreen_context;

let foreground;
let background;
let tries;
let digest;
let previousDigest;

let matches;

///////////////////////////////////////////////////////////////////////////////
// Utility code
///////////////////////////////////////////////////////////////////////////////

// Request the next animation frame on any platform version

window.requestAnimFrame =
  window.requestAnimationFrame  ||
  window.webkitRequestAnimationFrame ||
  window.mozRequestAnimationFrame    ||
  (callback => {
    window.setTimeout(callback, 1000 / 60);
  });

///////////////////////////////////////////////////////////////////////////////
// Create UI for each block
///////////////////////////////////////////////////////////////////////////////

const createSection = where => {
  const figure = document.createElement("span");
  figure.classList.add("page-grid-cell");
  // This is so the first cell isn't shorter than the others
  figure.style.height = canvas_size + extra_text_height;
  const canvas = document.createElement("canvas");
  canvas.width = canvas_size;
  canvas.height = canvas_size;
  const caption = document.createElement("p");
  caption.style['overflow-wrap'] = 'break-word';
  caption.style.width = canvas_size;
  figure.append(canvas);
  figure.append(caption);
  document.getElementById(where).append(figure);
  return {
    figure: figure,
    canvas: canvas,
    caption: caption,
    ctx: canvas.getContext('2d')
  };
};

///////////////////////////////////////////////////////////////////////////////
// The digest
///////////////////////////////////////////////////////////////////////////////

const newDigest = () => {
  const hash = sjcl.hash.sha256.hash(previousDigest + tries);
  const digest = sjcl.codec.hex.fromBits(hash);
  // Ensure the first and subsequent layouts line up
  const prev = previousDigest ? previousDigest : "None<br /><br />" ;
  ui.caption.innerHTML = "<b>Previous&nbsp;Digest:</b>&nbsp;" + prev +
    "&nbsp;<br /><b>Nonce:</b>&nbsp;" + tries +
    "<br /><b>SHA&#8209;256:</b>&nbsp;" + digest;
  return digest;
};

///////////////////////////////////////////////////////////////////////////////
// Drawing the digest as a bitmap
///////////////////////////////////////////////////////////////////////////////

const pixelValue8Bit = (x, y, bitmap_width, digest) => {
  const index = x + (y * bitmap_width);
  const grey = parseInt(digest[index], 16) * 16;
  return grey;
};

const pixelValue1Bit = (x, y, bitmap_width, digest) => {
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

const pixelValue = pixelValue1Bit;

// Ideally we'd just upscale and tween pixel values, but this looks better

const drawFace = (ui, digest) => {
   for(let y = 0; y < bitmap_size; y++) {
    for (let x = 0; x < bitmap_size; x++) {
      const colour = pixelValue(x, y, bitmap_size, digest);
      // Slower than other alternatives, but clear
      ui.ctx.fillStyle = colour;
      ui.ctx.fillRect(x * canvas_scale, y * canvas_scale,
                      canvas_scale, canvas_scale);
    }
  }
};

///////////////////////////////////////////////////////////////////////////////
// Making a blurred copy of the canvas to help detect faces more robustly
///////////////////////////////////////////////////////////////////////////////

let copyBlurred = (ui) => {
  offscreen_context.drawImage(ui.canvas, 0, 0);
  stackBlurCanvasRGB(offscreen_context, 0, 0, canvas_size, canvas_size,
                     blur_radius);
  ui.ctx.drawImage(offscreen, 0, 0);
};

///////////////////////////////////////////////////////////////////////////////
// Detecting the face in the digest bitmap
///////////////////////////////////////////////////////////////////////////////

const detectFace = canvas => {
  const image = new ccv.ccv_dense_matrix_t();
  ccv.ccv_read(offscreen, image, ccv.CCV_IO_GRAY);
/*  var matches = ccv.detect_objects(
    { "canvas" : offscreen)),
      "cascade" : cascade,
      "interval" : 10, // 5
      "min_neighbors" : 5 }); // 1 */
  const rects = ccv.ccv_scd_detect_objects(
    image,
    cascade,
    1,
    ccv.ccv_scd_default_params
  );
  const matches = rects.toJS();
  rects.delete();
  image.delete();
  return matches;
};

const drawMatches = (ui, matches) => {
  // Just draw the first one
  // In testing, multiples were overlapping matches of the same feature
  const match = matches[0];
  //matches.forEach(function(match) {
  //TODO: Clamp to bitmap pixel boundaries
  drawMatch(match.x, match.y, match.width, match.height);
  //});
};

const drawMatch = (match_x, match_y, match_width, match_height) => {
  const x = Math.ceil(match_x / canvas_scale) * canvas_scale;
  const y = Math.ceil(match_y / canvas_scale) * canvas_scale;
  const width = Math.floor(match_width / canvas_scale) * canvas_scale;
  const height = Math.floor(match_height / canvas_scale) * canvas_scale;
  ui.ctx.lineWidth = match_line_width;
  ui.ctx.strokeStyle = "rgb(255, 0, 0)";
  ui.ctx.rect(x ? x : 1, y ? y : 1, width, height);
  ui.ctx.stroke();
  ui.caption.innerHTML += "<br /><b>Face:</b>&nbsp;" +
    x + "," + y + "," + (x + width) + "," + (y + height);
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

const initNetwork = async () => {
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const facecoinJson = await ethers.utils.fetchJson(
    './js/FaceCoin.json'
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
  
  facecoinContract.on(transfer, onFacecoinTransfer);
};

const onFacecoinTransfer = async (from, to, id) => {
    updateState();
};

const updateState = async () => {
  const palette = await facecoinContract.tokenPalette(tokenId);
  background = `rgb(${palette[0].join(',')})`;
  foreground = `rgb(${palette[1].join(',')})`;
  tries = tokenId;
  previousDigest = await facecoinContract.ownerOf(tokenId);
  digest = null;
};

///////////////////////////////////////////////////////////////////////////////
// Main flow of execution
///////////////////////////////////////////////////////////////////////////////

const nextBlock = () => {
  // Don't add too many elements to the page, we don't want to hog memory
  const elements = document.getElementsByClassName('page-grid-cell');
  const to_truncate_at = Math.floor(truncate_blocks_at / 2);
  while (elements.length >= to_truncate_at)
  {
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


const animationLoop = () => {
  if (matches.length == 0) {
    requestAnimFrame(animationLoop);
    tries = tries + 1;
    digest = newDigest();
    drawFace(ui, digest);
    copyBlurred(ui);
    matches = detectFace(ui.canvas);
  } else {
    drawMatches(ui, matches);
    previousDigest = digest;
    nextBlock();
  }
};

window.addEventListener("DOMContentLoaded", async () => {
  maybeSetTokenFromHash();
  
  await initNetwork();

  await updateState();

  ccv = CCVLib({});
  cascade = [ccv.ccv_scd_classifier_cascade_read(ccv.CCV_SCD_FACE_FILE)];
  
  offscreen = document.createElement('canvas');
  offscreen.width = canvas_size;
  offscreen.height = canvas_size;
  offscreen_context = offscreen.getContext('2d');

  nextBlock();
});
