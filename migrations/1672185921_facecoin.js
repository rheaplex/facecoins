const Facecoin = artifacts.require("Facecoin");

module.exports = function(_deployer) {
  _deployer.deploy(Facecoin);
};

