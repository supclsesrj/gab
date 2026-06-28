// DocCheck — Gemini edition (versão CDN, sem imports)
const { useState, useCallback, useRef } = React;

const GEMINI_MODEL = "gemini-2.0-flash";

const PRESET_CHECKLISTS = {
  "Processo Licitatório": [
    "Termo de Referência ou Projeto Básico",
    "Edital de licitação",
    "Publicação no DOU ou diário oficial",
    "Ata de sessão pública",
    "Proposta vencedora",
    "Habilitação jurídica da empresa contratada",
    "Certidão de regularidade fiscal (CND Federal)",
    "Certidão de regularidade FGTS",
    "Certidão de regularidade trabalhista (CNDT)",
    "Minuta de contrato ou contrato assinado",
    "Parecer jurídico",
    "Nota de empenho",
  ],
  "Contrato Administrativo": [
    "Qualificação completa das partes",
    "Objeto contratual definido",
    "Valor e forma de pagamento",
    "Prazo de vigência",
    "Dotação orçamentária",
    "Garantia contratual",
    "Obrigações da contratada",
    "Obrigações da contratante",
    "Sanções administrativas",
    "Hipóteses de rescisão",
    "Foro competente",
    "Assinaturas e testemunhas",
  ],
  "Instrução Processual": [
    "Requerimento ou ofício de abertura",
    "Identificação do requerente",
    "Documentos de identificação (CPF/CNPJ)",
    "Procuração ou representação legal",
    "Documentação técnica pertinente",
    "Manifestação da área competente",
    "Parecer técnico",
    "Parecer jurídico",
    "Decisão administrativa",
    "Notificação ao interessado",
  ],
  "Personalizado": [],
};

const StatusBadge = ({ status }) => {
  const cfg = {
    presente:   { bg: "#ECFDF5", color: "#065F46", dot: "#10B981", label: "Presente" },
    ausente:    { bg: "#FEF2F2", color: "#991B1B", dot: "#EF4444", label: "Ausente" },
    parcial:    { bg: "#FFFBEB", color: "#92400E", dot: "#F59E0B", label: "Parcial" },
    analisando: { bg: "#EFF6FF", color: "#1E40AF", dot: "#3B82F6", label: "Analisando…" },
  }[status] || { bg: "#F3F4F6", color: "#374151", dot: "#9CA3AF", label: "Pendente" };

  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      background: cfg.bg, color: cfg.color,
      padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600,
    }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
};

const ChecklistItem = ({ item, index }) => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      border: "1px solid #E5E7EB", borderRadius: 8, overflow: "hidden",
      marginBottom: 8, background: "#fff",
    }}>
      <div
        onClick={() => item.trecho && setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "12px 16px", cursor: item.trecho ? "pointer" : "default",
        }}
      >
        <span style={{ color: "#9CA3AF", fontSize: 12, minWidth: 20, textAlign: "right" }}>{index + 1}</span>
        <span style={{ flex: 1, fontSize: 14, color: "#111827", fontWeight: 500 }}>{item.texto}</span>
        <StatusBadge status={item.status} />
        {item.trecho && (
          <span style={{ color: "#6B7280", fontSize: 12, marginLeft: 4 }}>{open ? "▲" : "▼"}</span>
        )}
      </div>
      {open && item.trecho && (
        <div style={{ background: "#F9FAFB", borderTop: "1px solid #E5E7EB", padding: "12px 16px 12px 48px" }}>
          <p style={{ fontSize: 12, color: "#6B7280", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em" }}>
            Trecho identificado
          </p>
          <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, margin: 0, fontStyle: "italic" }}>
            "{item.trecho}"
          </p>
          {item.observacao && (
            <p style={{ fontSize: 12, color: "#6B7280", marginTop: 8, marginBottom: 0 }}>
              ⚠ {item.observacao}
            </p>
          )}
        </div>
      )}
      {!open && item.status === "ausente" && item.observacao && (
        <div style={{ background: "#FEF2F2", borderTop: "1px solid #FEE2E2", padding: "8px 16px 8px 48px" }}>
          <p style={{ fontSize: 12, color: "#991B1B", margin: 0 }}>⚠ {item.observacao}</p>
        </div>
      )}
    </div>
  );
};

function App() {
  const [apiKey, setApiKey] = useState("");
  const [apiKeySet, setApiKeySet] = useState(false);
  const [presetKey, setPresetKey] = useState("Processo Licitatório");
  const [customItems, setCustomItems] = useState([]);
  const [newItem, setNewItem] = useState("");
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfBase64, setPdfBase64] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState(null);
  const fileRef = useRef();

  const activeItems = presetKey === "Personalizado"
    ? customItems
    : [...PRESET_CHECKLISTS[presetKey], ...customItems];

  const handleFile = (file) => {
    if (!file || file.type !== "application/pdf") {
      setError("Por favor, selecione um arquivo PDF.");
      return;
    }
    setPdfFile(file);
    setError("");
    setResults([]);
    setSummary(null);
    const reader = new FileReader();
    reader.onload = (e) => setPdfBase64(e.target.result.split(",")[1]);
    reader.readAsDataURL(file);
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    handleFile(e.dataTransfer.files[0]);
  }, []);

  const addCustomItem = () => {
    if (newItem.trim()) {
      setCustomItems(p => [...p, newItem.trim()]);
      setNewItem("");
    }
  };

  const removeCustomItem = (i) => setCustomItems(p => p.filter((_, idx) => idx !== i));

  const runAnalysis = async () => {
    if (!pdfBase64) { setError("Carregue um PDF primeiro."); return; }
    if (activeItems.length === 0) { setError("Adicione ao menos um item ao checklist."); return; }
    if (!apiKey) { setError("Informe sua chave de API do Gemini."); return; }

    setLoading(true);
    setError("");
    setResults(activeItems.map(t => ({ texto: t, status: "analisando" })));
    setSummary(null);

    const prompt = `Você é um assistente jurídico especializado em análise documental brasileira. Analise o documento PDF fornecido e verifique cada item do checklist abaixo.

Para cada item, retorne um objeto JSON com os campos:
- "status": "presente", "ausente" ou "parcial"
- "trecho": trecho literal do documento que evidencia o item (máximo 200 caracteres), ou null se ausente
- "observacao": observação relevante sobre o item, se houver (ou null)

Responda APENAS com um array JSON puro, sem texto antes ou depois, sem blocos de código, sem markdown.

CHECKLIST:
${activeItems.map((t, i) => `${i + 1}. ${t}`).join("\n")}

Critérios:
- "presente" = item claramente identificado no documento
- "parcial" = existe mas de forma incompleta, ambígua ou sem os elementos essenciais
- "ausente" = não encontrado no documento

O array deve ter exatamente ${activeItems.length} objetos, na mesma ordem do checklist.`;

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: "application/pdf", data: pdfBase64 } },
              { text: prompt },
            ],
          }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
        }),
      });

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error?.message || `Erro ${resp.status}`);
      }

      const data = await resp.json();
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const clean = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);

      if (!Array.isArray(parsed)) throw new Error("Resposta inesperada do modelo.");

      const mapped = activeItems.map((texto, i) => ({
        texto,
        status: parsed[i]?.status || "ausente",
        trecho: parsed[i]?.trecho || null,
        observacao: parsed[i]?.observacao || null,
      }));

      setResults(mapped);
      const presentes = mapped.filter(r => r.status === "presente").length;
      const parciais  = mapped.filter(r => r.status === "parcial").length;
      const ausentes  = mapped.filter(r => r.status === "ausente").length;
      setSummary({ presentes, parciais, ausentes, total: mapped.length });
    } catch (e) {
      setError("Erro na análise: " + e.message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const score = summary
    ? Math.round(((summary.presentes + summary.parciais * 0.5) / summary.total) * 100)
    : null;

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", minHeight: "100vh", background: "#F8F9FB" }}>
      {/* Header */}
      <div style={{ background: "#0F172A", padding: "0 32px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: "#4F8EF7", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#fff", fontSize: 14 }}>✓</span>
            </div>
            <span style={{ color: "#F1F5F9", fontWeight: 700, fontSize: 15, letterSpacing: "-.01em" }}>DocCheck</span>
            <span style={{ color: "#475569", fontSize: 12, marginLeft: 4 }}>by Ítalo Peixoto</span>
          </div>
          <span style={{ color: "#64748B", fontSize: 12 }}>Análise de Conformidade Documental · Gemini</span>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>

        {/* API Key */}
        {!apiKeySet ? (
          <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: 24, marginBottom: 24 }}>
            <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: "#374151" }}>Chave de API — Google AI Studio (Gemini)</p>
            <p style={{ margin: "0 0 12px", fontSize: 12, color: "#6B7280" }}>
              Necessária para processar os documentos. Sua chave não é armazenada — fica apenas na memória desta sessão.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                onKeyDown={e => e.key === "Enter" && apiKey.length > 10 && setApiKeySet(true)}
                style={{ flex: 1, padding: "9px 12px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 13, outline: "none" }}
              />
              <button
                onClick={() => apiKey.length > 10 && setApiKeySet(true)}
                style={{ padding: "9px 20px", background: "#0F172A", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Confirmar
              </button>
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 11, color: "#9CA3AF" }}>
              Obtenha sua chave gratuitamente em aistudio.google.com → Get API Key
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
            <button onClick={() => { setApiKeySet(false); setApiKey(""); }} style={{ fontSize: 12, color: "#6B7280", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
              Alterar chave de API
            </button>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* Checklist */}
          <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: 24 }}>
            <p style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: "#0F172A" }}>Checklist</p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: "#6B7280", fontWeight: 600, display: "block", marginBottom: 6 }}>Modelo predefinido</label>
              <select
                value={presetKey}
                onChange={e => setPresetKey(e.target.value)}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 13, background: "#fff", outline: "none" }}
              >
                {Object.keys(PRESET_CHECKLISTS).map(k => <option key={k}>{k}</option>)}
              </select>
            </div>

            {presetKey !== "Personalizado" && (
              <div style={{ marginBottom: 16, maxHeight: 220, overflowY: "auto" }}>
                <p style={{ fontSize: 12, color: "#6B7280", fontWeight: 600, marginBottom: 8 }}>Itens do modelo</p>
                {PRESET_CHECKLISTS[presetKey].map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "5px 0", borderBottom: "1px solid #F3F4F6" }}>
                    <span style={{ color: "#4F8EF7", fontSize: 12, marginTop: 1 }}>✓</span>
                    <span style={{ fontSize: 12, color: "#374151" }}>{item}</span>
                  </div>
                ))}
              </div>
            )}

            <div>
              <p style={{ fontSize: 12, color: "#6B7280", fontWeight: 600, marginBottom: 8 }}>
                {presetKey === "Personalizado" ? "Itens do checklist" : "Itens adicionais"}
              </p>
              {customItems.length === 0 && presetKey !== "Personalizado" && (
                <p style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 8 }}>Adicione itens extras ao modelo acima.</p>
              )}
              {customItems.map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "1px solid #F3F4F6" }}>
                  <span style={{ color: "#8B5CF6", fontSize: 12 }}>+</span>
                  <span style={{ flex: 1, fontSize: 12, color: "#374151" }}>{item}</span>
                  <button onClick={() => removeCustomItem(i)} style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer", fontSize: 14, padding: "0 4px" }}>×</button>
                </div>
              ))}
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                <input
                  value={newItem}
                  onChange={e => setNewItem(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addCustomItem()}
                  placeholder="Novo item…"
                  style={{ flex: 1, padding: "7px 10px", border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 12, outline: "none" }}
                />
                <button
                  onClick={addCustomItem}
                  style={{ padding: "7px 14px", background: "#F1F5F9", border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 12, cursor: "pointer", fontWeight: 600 }}
                >
                  +
                </button>
              </div>
            </div>

            <div style={{ marginTop: 16, padding: "10px 14px", background: "#F8F9FB", borderRadius: 8, border: "1px solid #E2E8F0" }}>
              <span style={{ fontSize: 12, color: "#6B7280" }}>
                Total: <strong style={{ color: "#0F172A" }}>{activeItems.length} itens</strong>
              </span>
            </div>
          </div>

          {/* Upload + Summary + Botão */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: 24 }}>
              <p style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: "#0F172A" }}>Documento PDF</p>
              <div
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileRef.current.click()}
                style={{
                  border: `2px dashed ${pdfFile ? "#4F8EF7" : "#D1D5DB"}`,
                  borderRadius: 10, padding: "32px 16px", textAlign: "center",
                  cursor: "pointer", background: pdfFile ? "#EFF6FF" : "#FAFAFA",
                  transition: "all .15s",
                }}
              >
                <input ref={fileRef} type="file" accept=".pdf" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
                {pdfFile ? (
                  <>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#1E40AF" }}>{pdfFile.name}</p>
                    <p style={{ margin: "4px 0 0", fontSize: 11, color: "#6B7280" }}>
                      {(pdfFile.size / 1024).toFixed(0)} KB — clique para trocar
                    </p>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>📂</div>
                    <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>Arraste um PDF ou <strong style={{ color: "#4F8EF7" }}>clique para selecionar</strong></p>
                  </>
                )}
              </div>
            </div>

            {summary && (
              <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Resultado geral</p>
                  <span style={{
                    fontSize: 22, fontWeight: 800,
                    color: score >= 80 ? "#065F46" : score >= 50 ? "#92400E" : "#991B1B",
                  }}>
                    {score}%
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  {[
                    { label: "Presentes", value: summary.presentes, color: "#10B981" },
                    { label: "Parciais",  value: summary.parciais,  color: "#F59E0B" },
                    { label: "Ausentes",  value: summary.ausentes,  color: "#EF4444" },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ textAlign: "center", padding: "10px 8px", background: "#F8F9FB", borderRadius: 8 }}>
                      <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color }}>{value}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: "#6B7280" }}>{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div style={{ background: "#FEF2F2", border: "1px solid #FEE2E2", borderRadius: 8, padding: "12px 16px" }}>
                <p style={{ margin: 0, fontSize: 13, color: "#991B1B" }}>{error}</p>
              </div>
            )}

            <button
              onClick={runAnalysis}
              disabled={loading || !pdfFile || !apiKeySet}
              style={{
                padding: "14px 24px",
                background: loading || !pdfFile || !apiKeySet ? "#E2E8F0" : "#0F172A",
                color: loading || !pdfFile || !apiKeySet ? "#9CA3AF" : "#fff",
                border: "none", borderRadius: 10,
                fontSize: 14, fontWeight: 700,
                cursor: loading || !pdfFile || !apiKeySet ? "not-allowed" : "pointer",
                transition: "all .15s",
              }}
            >
              {loading ? "Analisando documento…" : "Analisar documento"}
            </button>
          </div>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div style={{ marginTop: 24, background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: 24 }}>
            <p style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: "#0F172A" }}>
              Resultado item a item
              {!loading && (
                <span style={{ fontSize: 12, color: "#6B7280", fontWeight: 400, marginLeft: 8 }}>
                  clique em um item para ver o trecho do documento
                </span>
              )}
            </p>
            {results.map((item, i) => <ChecklistItem key={i} item={item} index={i} />)}
          </div>
        )}
      </div>
    </div>
  );
}
