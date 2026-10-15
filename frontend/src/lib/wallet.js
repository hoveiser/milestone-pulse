import { generatePrivateKey, createAccount } from "genlayer-js";

const KEY = "milestonepulse.burner.pk";

function addressFrom(pk) {
  try {
    return createAccount(pk).address;
  } catch {
    return "";
  }
}

// Mode A: local burner wallet persisted in localStorage. Gasless studionet makes
// this the zero-friction way for a steward to sign from multiple identities.
export function loadBurner() {
  let pk = localStorage.getItem(KEY);
  if (!pk) {
    pk = generatePrivateKey();
    localStorage.setItem(KEY, pk);
  }
  return { privateKey: pk, address: addressFrom(pk) };
}

export function rotateBurner() {
  const pk = generatePrivateKey();
  localStorage.setItem(KEY, pk);
  return { privateKey: pk, address: addressFrom(pk) };
}

// Mode B: connect an injected EIP-1193 wallet (MetaMask).
export async function connectInjected() {
  if (!window.ethereum) {
    throw new Error("No injected EIP-1193 wallet found. Install MetaMask to use Mode B.");
  }
  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  const chainId = await window.ethereum.request({ method: "eth_chainId" });
  if (parseInt(chainId, 16) !== 61999) {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xF22F" }],
      });
    } catch {
      // Chain may not be registered in the wallet; reads still work via the SDK.
    }
  }
  return { address: accounts[0] };
}
