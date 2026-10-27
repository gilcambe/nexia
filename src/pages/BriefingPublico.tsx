import React, { useState } from "react";
import { useParams } from "react-router-dom";

interface FormData {
  nomeEAtividade: string;
  cidadeEndereco: string;
  whatsapp: string;
  telefone: string;
  email: string;
  instagram: string;
  horarioFuncionamento: string;
  servicosProdutos: string;
  motivosDiferenciais: string;
  siteReferencia: string;
  nicho: string;
}

export default function BriefingPublico() {
  const { codigo } = useParams<{ codigo: string }>();

  // Validação do código de briefing
  const codigoLimpo = (codigo || "").trim().toLowerCase();
  const codigoInvalido =
    !codigoLimpo ||
    codigoLimpo === "expirado" ||
    codigoLimpo === "invalido" ||
    codigoLimpo === "null" ||
    codigoLimpo === "undefined";

  const [formData, setFormData] = useState<FormData>({
    nomeEAtividade: "",
    cidadeEndereco: "",
    whatsapp: "",
    telefone: "",
    email: "",
    instagram: "",
    horarioFuncionamento: "",
    servicosProdutos: "",
    motivosDiferenciais: "",
    siteReferencia: "",
    nicho: "geral",
  });

  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [fotos, setFotos] = useState<File[]>([]);
  const [fotosPreviews, setFotosPreviews] = useState<string[]>([]);

  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const NICHOS = [
    { value: "geral", label: "Geral / Outros" },
    { value: "advogado", label: "Advocacia / Jurídico" },
    { value: "clinica", label: "Clínica Médica / Saúde" },
    { value: "dentista", label: "Odontologia / Dentista" },
    { value: "estetica", label: "Estética e Beleza" },
    { value: "nutricao", label: "Nutrição / Bem-estar" },
    { value: "imobiliaria", label: "Imobiliária / Corretor" },
  ];

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (erros[name]) {
      setErros((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErros((prev) => ({ ...prev, logo: "Selecione apenas um arquivo de imagem." }));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErros((prev) => ({ ...prev, logo: "O arquivo da logo deve ter no máximo 5MB." }));
      return;
    }

    setErros((prev) => ({ ...prev, logo: "" }));
    setLogo(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleFotosChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const fotosValidas: File[] = [];
    const previewsNovas: string[] = [];
    let erroMensagem = "";

    if (fotos.length + files.length > 10) {
      setErros((prev) => ({ ...prev, fotos: "Você pode enviar no máximo 10 fotos." }));
      return;
    }

    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        erroMensagem = "Todos os arquivos devem ser imagens.";
        break;
      }
      if (file.size > 5 * 1024 * 1024) {
        erroMensagem = "Cada foto deve ter no máximo 5MB.";
        break;
      }
      fotosValidas.push(file);
      previewsNovas.push(URL.createObjectURL(file));
    }

    if (erroMensagem) {
      setErros((prev) => ({ ...prev, fotos: erroMensagem }));
      return;
    }

    setErros((prev) => ({ ...prev, fotos: "" }));
    setFotos((prev) => [...prev, ...fotosValidas]);
    setFotosPreviews((prev) => [...prev, ...previewsNovas]);
  };

  const removerFoto = (index: number) => {
    setFotos((prev) => prev.filter((_, i) => i !== index));
    setFotosPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const novosErros: Record<string, string> = {};

    if (!formData.nomeEAtividade.trim()) {
      novosErros.nomeEAtividade = "Por favor, informe o nome da empresa e o que faz.";
    }
    if (!formData.whatsapp.trim() && !formData.email.trim()) {
      novosErros.whatsapp = "Informe ao menos um WhatsApp ou E-mail para contato.";
    }

    if (Object.keys(novosErros).length > 0) {
      setErros(novosErros);
      return;
    }

    setEnviando(true);
    // Simula o envio do formulário de briefing público
    setTimeout(() => {
      setEnviando(false);
      setEnviado(true);
    }, 800);
  };

  if (codigoInvalido) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#16161f] border border-red-500/30 rounded-2xl p-6 text-center shadow-xl">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 text-red-400 text-3xl">
            <i className="ri-error-warning-line" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Código Inválido ou Expirado</h1>
          <p className="text-sm text-gray-400 mb-6">
            O código de briefing informado (<code className="text-red-300 font-mono">{codigo}</code>) não é válido ou já expirou. Solicite um novo link ao responsável.
          </p>
          <div className="text-xs text-gray-500 border-t border-[#26262f] pt-4">
            KERNEX — Inteligência que resolve.
          </div>
        </div>
      </div>
    );
  }

  if (enviado) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#16161f] border border-[#00d4aa]/30 rounded-2xl p-6 text-center shadow-xl">
          <div className="w-16 h-16 bg-[#00d4aa]/10 rounded-full flex items-center justify-center mx-auto mb-4 text-[#00d4aa] text-3xl">
            <i className="ri-checkbox-circle-line" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Briefing Enviado!</h1>
          <p className="text-sm text-gray-300 mb-6">
            Obrigado por preencher as informações. Os dados foram recebidos com sucesso e nossa equipe já iniciou o processamento.
          </p>
          <div className="text-xs text-gray-500 border-t border-[#26262f] pt-4">
            KERNEX — Inteligência que resolve.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-100 py-8 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto bg-[#16161f] border border-[#26262f] rounded-2xl p-6 sm:p-8 shadow-2xl">
        {/* Cabeçalho */}
        <div className="mb-8 border-b border-[#26262f] pb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00d4aa]/10 text-[#00d4aa] text-xs font-semibold mb-3">
            <i className="ri-file-list-3-line" /> Formulário de Briefing
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Informações do Seu Projeto</h1>
          <p className="text-sm text-gray-400">
            Preencha as 10 perguntas abaixo para orientar a criação e personalização do seu site ou aplicação.
          </p>
          <div className="mt-3 text-xs text-gray-500 font-mono">
            Código do convite: <span className="text-[#00d4aa] font-semibold">{codigo}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 1. Nome da empresa e o que faz */}
          <div>
            <label className="block text-sm font-semibold text-gray-200 mb-1">
              1. Nome da empresa / cliente e o que faz <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              name="nomeEAtividade"
              value={formData.nomeEAtividade}
              onChange={handleInputChange}
              placeholder="Ex: Clínica OdontoViva - Odontologia estética e implantes"
              className="w-full bg-[#0a0a0f] border border-[#26262f] focus:border-[#00d4aa] rounded-xl px-4 py-3 text-sm text-white outline-none transition"
            />
            {erros.nomeEAtividade && (
              <p className="text-xs text-red-400 mt-1">{erros.nomeEAtividade}</p>
            )}
          </div>

          {/* 2. Cidade e Endereço */}
          <div>
            <label className="block text-sm font-semibold text-gray-200 mb-1">
              2. Cidade, Estado e Endereço completo
            </label>
            <input
              type="text"
              name="cidadeEndereco"
              value={formData.cidadeEndereco}
              onChange={handleInputChange}
              placeholder="Ex: São Paulo - SP, Av. Paulista, 1000 - Sala 42"
              className="w-full bg-[#0a0a0f] border border-[#26262f] focus:border-[#00d4aa] rounded-xl px-4 py-3 text-sm text-white outline-none transition"
            />
          </div>

          {/* 3. WhatsApp, Telefone, E-mail, Instagram */}
          <div>
            <label className="block text-sm font-semibold text-gray-200 mb-2">
              3. Contatos (WhatsApp, Telefone, E-mail, Instagram)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <input
                  type="text"
                  name="whatsapp"
                  value={formData.whatsapp}
                  onChange={handleInputChange}
                  placeholder="WhatsApp (ex: 11999998888)"
                  className="w-full bg-[#0a0a0f] border border-[#26262f] focus:border-[#00d4aa] rounded-xl px-4 py-2.5 text-sm text-white outline-none transition"
                />
              </div>
              <div>
                <input
                  type="text"
                  name="telefone"
                  value={formData.telefone}
                  onChange={handleInputChange}
                  placeholder="Telefone Fixo (opcional)"
                  className="w-full bg-[#0a0a0f] border border-[#26262f] focus:border-[#00d4aa] rounded-xl px-4 py-2.5 text-sm text-white outline-none transition"
                />
              </div>
              <div>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="E-mail de contato"
                  className="w-full bg-[#0a0a0f] border border-[#26262f] focus:border-[#00d4aa] rounded-xl px-4 py-2.5 text-sm text-white outline-none transition"
                />
              </div>
              <div>
                <input
                  type="text"
                  name="instagram"
                  value={formData.instagram}
                  onChange={handleInputChange}
                  placeholder="Instagram (ex: @suaempresa)"
                  className="w-full bg-[#0a0a0f] border border-[#26262f] focus:border-[#00d4aa] rounded-xl px-4 py-2.5 text-sm text-white outline-none transition"
                />
              </div>
            </div>
            {erros.whatsapp && <p className="text-xs text-red-400 mt-1">{erros.whatsapp}</p>}
          </div>

          {/* 4. Horário de funcionamento */}
          <div>
            <label className="block text-sm font-semibold text-gray-200 mb-1">
              4. Horário de funcionamento
            </label>
            <input
              type="text"
              name="horarioFuncionamento"
              value={formData.horarioFuncionamento}
              onChange={handleInputChange}
              placeholder="Ex: Segunda a Sexta das 08h às 18h / Sábado das 08h às 12h"
              className="w-full bg-[#0a0a0f] border border-[#26262f] focus:border-[#00d4aa] rounded-xl px-4 py-3 text-sm text-white outline-none transition"
            />
          </div>

          {/* 5. Serviços ou produtos oferecidos */}
          <div>
            <label className="block text-sm font-semibold text-gray-200 mb-1">
              5. Serviços ou produtos oferecidos
            </label>
            <textarea
              name="servicosProdutos"
              value={formData.servicosProdutos}
              onChange={handleInputChange}
              rows={3}
              placeholder="Liste os principais serviços ou produtos oferecidos pela empresa..."
              className="w-full bg-[#0a0a0f] border border-[#26262f] focus:border-[#00d4aa] rounded-xl px-4 py-3 text-sm text-white outline-none transition resize-none"
            />
          </div>

          {/* 6. 3 motivos / diferenciais */}
          <div>
            <label className="block text-sm font-semibold text-gray-200 mb-1">
              6. 3 Motivos / Diferenciais para escolher sua empresa
            </label>
            <textarea
              name="motivosDiferenciais"
              value={formData.motivosDiferenciais}
              onChange={handleInputChange}
              rows={3}
              placeholder="1. Atendimento personalizado&#10;2. Mais de 10 anos de experiência&#10;3. Tecnologia de ponta"
              className="w-full bg-[#0a0a0f] border border-[#26262f] focus:border-[#00d4aa] rounded-xl px-4 py-3 text-sm text-white outline-none transition resize-none"
            />
          </div>

          {/* 7. Upload de Logo */}
          <div>
            <label className="block text-sm font-semibold text-gray-200 mb-1">
              7. Logo da empresa (máx. 5MB, apenas imagem)
            </label>
            <div className="flex items-center gap-4">
              <label className="cursor-pointer bg-[#0a0a0f] hover:bg-[#1a1a24] border border-[#26262f] hover:border-[#00d4aa] text-gray-300 hover:text-white px-4 py-2.5 rounded-xl text-sm font-medium transition inline-flex items-center gap-2">
                <i className="ri-upload-2-line" /> Escolher Logo
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="hidden"
                />
              </label>
              {logoPreview && (
                <div className="relative w-12 h-12 rounded-lg border border-[#26262f] overflow-hidden bg-[#0a0a0f]">
                  <img src={logoPreview} alt="Preview da Logo" className="w-full h-full object-contain" />
                </div>
              )}
            </div>
            {erros.logo && <p className="text-xs text-red-400 mt-1">{erros.logo}</p>}
          </div>

          {/* 8. Upload de Fotos */}
          <div>
            <label className="block text-sm font-semibold text-gray-200 mb-1">
              8. Fotos do estabelecimento / trabalho (máx. 10 fotos, 5MB cada)
            </label>
            <label className="cursor-pointer bg-[#0a0a0f] hover:bg-[#1a1a24] border border-[#26262f] hover:border-[#00d4aa] text-gray-300 hover:text-white px-4 py-2.5 rounded-xl text-sm font-medium transition inline-flex items-center gap-2">
              <i className="ri-image-add-line" /> Adicionar Fotos ({fotos.length}/10)
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFotosChange}
                disabled={fotos.length >= 10}
                className="hidden"
              />
            </label>
            {erros.fotos && <p className="text-xs text-red-400 mt-1">{erros.fotos}</p>}

            {fotosPreviews.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-3">
                {fotosPreviews.map((preview, idx) => (
                  <div key={idx} className="relative group aspect-square rounded-lg border border-[#26262f] overflow-hidden bg-[#0a0a0f]">
                    <img src={preview} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removerFoto(idx)}
                      className="absolute top-1 right-1 bg-red-600/80 hover:bg-red-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs transition"
                      title="Remover foto"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 9. Site de referência (opcional) */}
          <div>
            <label className="block text-sm font-semibold text-gray-200 mb-1">
              9. Site de referência ou inspiração (opcional)
            </label>
            <input
              type="url"
              name="siteReferencia"
              value={formData.siteReferencia}
              onChange={handleInputChange}
              placeholder="https://exemplo.com.br"
              className="w-full bg-[#0a0a0f] border border-[#26262f] focus:border-[#00d4aa] rounded-xl px-4 py-3 text-sm text-white outline-none transition"
            />
          </div>

          {/* 10. Seleção de nicho */}
          <div>
            <label className="block text-sm font-semibold text-gray-200 mb-1">
              10. Seleção de Nicho
            </label>
            <select
              name="nicho"
              value={formData.nicho}
              onChange={handleInputChange}
              className="w-full bg-[#0a0a0f] border border-[#26262f] focus:border-[#00d4aa] rounded-xl px-4 py-3 text-sm text-white outline-none transition"
            >
              {NICHOS.map((n) => (
                <option key={n.value} value={n.value}>
                  {n.label}
                </option>
              ))}
            </select>
          </div>

          {/* Botão de Enviar */}
          <div className="pt-4 border-t border-[#26262f]">
            <button
              type="submit"
              disabled={enviando}
              className="w-full bg-[#00d4aa] hover:bg-[#00b894] disabled:opacity-50 text-black font-semibold py-3.5 px-6 rounded-xl transition flex items-center justify-center gap-2 text-base shadow-lg shadow-[#00d4aa]/10"
            >
              {enviando ? (
                <>
                  <i className="ri-loader-4-line animate-spin" /> Enviando briefing...
                </>
              ) : (
                <>
                  <i className="ri-send-plane-fill" /> Enviar Briefing
                </>
              )}
            </button>
          </div>
        </form>

        <div className="mt-8 pt-4 border-t border-[#26262f] text-center text-xs text-gray-500">
          KERNEX — Inteligência que resolve.
        </div>
      </div>
    </div>
  );
}
