const FaceCoin = artifacts.require("FaceCoin");

/*
 * uncomment accounts to access the test accounts made available by the
 * Ethereum client
 * See docs: https://www.trufflesuite.com/docs/truffle/testing/writing-tests-in-javascript
 */
contract("FaceCoin", function (/* accounts */) {
  it("should assert true", async function () {
    await FaceCoin.deployed();
    return assert.isTrue(true);
  });
});
