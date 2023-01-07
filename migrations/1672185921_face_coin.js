const FaceCoin = artifacts.require("FaceCoin");

module.exports = function(_deployer) {
  _deployer.deploy(FaceCoin);
};

