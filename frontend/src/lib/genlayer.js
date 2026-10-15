import { createClient, createAccount, chains } from "genlayer-js";
import { CONTRACT_ADDRESS, RPC_URL } from "./config";

// Read-only client (no signer needed for view calls).
export function readClient() {
  return createClient({ chain: chains.studionet, rpcUrl: RPC_URL });
}

// Write client bound to a concrete signer (burner or injected wallet account).
export function writeClient(privateKey) {
  const account = createAccount(privateKey);
  return { client: createClient({ chain: chains.studionet, account, rpcUrl: RPC_URL }), address: account.address };
}

export async function readView(functionName, args = []) {
  const client = readClient();
  return client.readContract({ address: CONTRACT_ADDRESS, functionName, args });
}

// Submits a state-changing call and resolves to the GenLayer transaction hash.
export async function submitWrite(privateKey, functionName, args = []) {
  const { client } = writeClient(privateKey);
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName,
    args,
  });
  return typeof hash === "string" ? hash : hash?.hash ?? String(hash);
}

// Best-effort consensus status lookup; never throws to the UI.
export async function txStatus(hash) {
  try {
    const client = readClient();
    const rc = await client.getTransactionReceipt(hash);
    return rc?.statusName ?? rc?.status ?? "PENDING";
  } catch {
    return "PENDING";
  }
}
