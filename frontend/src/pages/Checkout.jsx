import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import { ArrowLeft, Copy, Check, Loader2, ShieldCheck, ExternalLink, AlertCircle, Wallet } from "lucide-react";
import { toast } from "sonner";
import api, { formatApiErrorDetail } from "@/lib/api";

function copy(value) {
  try {
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(value);
    else {
      const ta = document.createElement("textarea");
      ta.value = value; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
    }
    toast.success("Copied");
  } catch { toast.error("Clipboard blocked — copy manually"); }
}

function QRBox({ data, image }) {
  if (image) {
    return (
      <div className="bg-white p-3 rounded-2xl inline-block">
        <img alt="qr" src={image} width={200} height={200} className="block" data-testid="qr-image" />
      </div>
    );
  }
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data)}&bgcolor=0b0f19&color=ffffff&margin=8`;
  return (
    <div className="bg-white p-3 rounded-2xl inline-block">
      <img alt="qr" src={src} width={200} height={200} data-testid="qr-image" />
    </div>
  );
}

const NET_LABEL = {
  trc20: { label: "USDT · TRC-20 (Tron)", chain: "Tron", fee: "≈ 1 USDT", color: "text-red-300" },
  bep20: { label: "USDT · BEP-20 (BNB Chain)", chain: "BSC", fee: "≈ $0.10", color: "text-amber-300" },
};

export default function Checkout() {
  const { plan } = useParams();
  const [sp] = useSearchParams();
  const resumeId = sp.get("resume");
  const navigate = useNavigate();

  const [step, setStep] = useState(resumeId ? 2 : 1);
  const [cycle, setCycle] = useState("monthly");
  const [network, setNetwork] = useState("trc20");
  const [payment, setPayment] = useState(null);
  const [txHash, setTxHash] = useState("");
  const [busy, setBusy] = useState(false);
  const [autoBusy, setAutoBusy] = useState(false);

  useEffect(() => {
    if (resumeId) {
      api.get("/billing/payments").then(({ data }) => {
        const found = data.find((p) => p.id === resumeId);
        if (found) {
          setPayment(found);
          setCycle(found.billing_cycle);
          setNetwork(found.network);
          setTxHash(found.tx_hash || "");
          setStep(2);
        }
      });
    }
  }, [resumeId]);

  const createPayment = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/billing/checkout", {
        plan,
        billing_cycle: plan === "lifetime" ? "lifetime" : cycle,
        network,
      });
      setPayment(data);
      setStep(2);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Failed");
    } finally { setBusy(false); }
  };

  const submitTx = async () => {
    if (!txHash.trim()) { toast.error("Enter the TX hash"); return; }
    setBusy(true);
    try {
      const { data } = await api.post("/billing/submit-tx", { payment_id: payment.id, tx_hash: txHash.trim() });
      toast.success("TX submitted. Awaiting confirmation.");
      setPayment({ ...payment, tx_hash: txHash.trim(), status: "submitted", explorer_url: data.explorer_url });
      setStep(3);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setBusy(false); }
  };

  const autoVerify = async () => {
    setAutoBusy(true);
    try {
      const { data } = await api.post(`/billing/auto-verify/${payment.id}`);
      if (data.ok) {
        toast.success("Confirmed on-chain. Subscription activated!");
        navigate("/billing");
      } else {
        toast.message("Not yet confirmed", { description: data.error });
      }
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setAutoBusy(false); }
  };

  const planLabel = plan?.charAt(0).toUpperCase() + plan?.slice(1);

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      <div>
        <Link to="/billing" className="inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-white" data-testid="checkout-back">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to billing
        </Link>
      </div>

      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-indigo-300/80">Checkout</p>
        <h1 className="text-3xl lg:text-4xl font-semibold mt-2 tracking-tight">{planLabel}</h1>
      </header>

      <div className="flex items-center gap-2 text-[11px] text-zinc-500">
        <span className={`w-6 h-6 rounded-full flex items-center justify-center ${step >= 1 ? "btn-gradient text-white" : "bg-white/5"}`}>1</span> Plan
        <span className="flex-1 h-px bg-white/5" />
        <span className={`w-6 h-6 rounded-full flex items-center justify-center ${step >= 2 ? "btn-gradient text-white" : "bg-white/5"}`}>2</span> Pay
        <span className="flex-1 h-px bg-white/5" />
        <span className={`w-6 h-6 rounded-full flex items-center justify-center ${step >= 3 ? "btn-gradient text-white" : "bg-white/5"}`}>3</span> Activate
      </div>

      {step === 1 && (
        <div className="glass-card rounded-[24px] p-7" data-testid="checkout-step-1">
          {plan !== "lifetime" && (
            <>
              <div className="text-xs uppercase tracking-wider text-zinc-400 mb-2">Billing cycle</div>
              <div className="flex gap-2 mb-6">
                {["monthly", "annual"].map((c) => (
                  <button
                    key={c}
                    onClick={() => setCycle(c)}
                    data-testid={`cycle-${c}`}
                    className={`flex-1 py-3 rounded-xl border text-sm transition ${cycle === c ? "btn-gradient border-transparent" : "border-white/10 hover:border-white/30 hover:bg-white/5"}`}
                  >
                    {c === "monthly" ? "Monthly" : "Annual · 2 months free"}
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="text-xs uppercase tracking-wider text-zinc-400 mb-2">Network</div>
          <div className="grid grid-cols-2 gap-2 mb-6">
            {Object.entries(NET_LABEL).map(([k, v]) => (
              <button
                key={k}
                onClick={() => setNetwork(k)}
                data-testid={`network-${k}`}
                className={`p-4 rounded-xl border text-left transition ${network === k ? "border-indigo-500/40 bg-indigo-500/5" : "border-white/10 hover:bg-white/5"}`}
              >
                <div className="flex items-center gap-2">
                  <Wallet className={`w-4 h-4 ${v.color}`} />
                  <span className="text-sm font-medium">{v.label}</span>
                </div>
                <div className="text-[11px] text-zinc-500 mt-1">Network fee {v.fee}</div>
              </button>
            ))}
          </div>

          <button onClick={createPayment} disabled={busy} className="btn-gradient w-full py-3 text-sm flex items-center justify-center gap-2" data-testid="create-payment-btn">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            Continue to payment
          </button>
        </div>
      )}

      {step >= 2 && payment && (
        <div className="glass-card rounded-[24px] p-7" data-testid="checkout-step-2">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
            <div>
              <div className="text-xs text-zinc-500">You owe</div>
              <div className="text-3xl font-semibold tracking-tight" data-testid="payment-amount">${payment.amount_usdt} USDT</div>
              <div className="text-xs text-zinc-500 mt-1">{NET_LABEL[payment.network].label}</div>
            </div>
            <span className={`status-badge ${payment.status === "confirmed" ? "status-active" : payment.status === "rejected" ? "status-dead" : "status-checking"}`}>
              {payment.status.replace("_", " ")}
            </span>
          </div>

          <div className="flex flex-col lg:flex-row gap-6 items-start">
            <div className="shrink-0 self-center"><QRBox data={payment.wallet_address} image={payment.wallet_qr} /></div>
            <div className="flex-1 flex flex-col gap-4 w-full">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-zinc-400 mb-1.5">Send to address</div>
                <div className="flex items-center gap-2">
                  <code className="mono text-xs bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 flex-1 break-all" data-testid="wallet-address">
                    {payment.wallet_address}
                  </code>
                  <button onClick={() => copy(payment.wallet_address)} className="px-3 py-2.5 rounded-lg border border-white/10 hover:bg-white/5" data-testid="copy-address">
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200 flex gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                Send <span className="font-semibold mono">{payment.amount_usdt} USDT</span> on the <span className="font-semibold uppercase">{payment.network}</span> network only. Any other coin or wrong network will be lost.
              </div>

              <div>
                <div className="text-[11px] uppercase tracking-wider text-zinc-400 mb-1.5">Paste your TX hash</div>
                <input
                  value={txHash}
                  onChange={(e) => setTxHash(e.target.value)}
                  placeholder="0x… or 64-char hex"
                  className="glass-input w-full px-3 py-2.5 text-sm mono"
                  data-testid="tx-hash-input"
                />
              </div>

              {payment.status === "awaiting_tx" || payment.status === "rejected" ? (
                <button onClick={submitTx} disabled={busy} className="btn-gradient w-full py-3 text-sm flex items-center justify-center gap-2" data-testid="submit-tx-btn">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} I've sent it — submit TX
                </button>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2">
                  {payment.explorer_url && (
                    <a href={payment.explorer_url} target="_blank" rel="noreferrer" className="flex-1 text-center py-3 rounded-xl border border-white/10 hover:bg-white/5 text-sm flex items-center justify-center gap-2">
                      View on explorer <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {payment.status !== "confirmed" && (
                    <button onClick={autoVerify} disabled={autoBusy} className="btn-gradient flex-1 py-3 text-sm flex items-center justify-center gap-2" data-testid="auto-verify-btn">
                      {autoBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} Auto-verify on chain
                    </button>
                  )}
                </div>
              )}

              {payment.status === "submitted" && (
                <p className="text-[11px] text-zinc-500">
                  An admin will approve manually within minutes, or click <span className="text-indigo-300">Auto-verify</span> above to confirm on-chain instantly.
                </p>
              )}
              {payment.reject_reason && (
                <p className="text-xs text-red-300">Rejected: {payment.reject_reason}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
