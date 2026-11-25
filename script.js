import { onValue, update, get, child, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { varalRef, historicoRef } from "./firebase.js";

// Elementos da Interface
const btnToggle = document.getElementById('btn-toggle-varal');
const txtStatus = document.getElementById('varal-status');
const txtSensor = document.getElementById('sensor-status');
const checkAuto = document.getElementById('check-auto');

// Elementos de Estatísticas
const elAberto24h = document.getElementById('tempo-aberto-24h');
const elFechado24h = document.getElementById('tempo-fechado-24h');
const elSemAtualAberto = document.getElementById('sem-atual-aberto');
const elSemAtualFechado = document.getElementById('sem-atual-fechado');
const elSemAntAberto = document.getElementById('sem-ant-aberto');
const elSemAntFechado = document.getElementById('sem-ant-fechado');

// Variáveis de controle de estado e tempo
let estadoAtual = "ESTENDIDO";
let ultimoEventoTimestamp = null;
let dadosHistorico = {};

// Retorna a data no formato YYYY-MM-DD (fuso local)
function getDataKey(dateObj = new Date()) {
    const ano = dateObj.getFullYear();
    const mes = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dia = String(dateObj.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

// Formata milissegundos em "Xh YYm"
function formatarTempo(ms) {
    if (!ms || ms < 0) return "0h 00m";
    const totalMinutos = Math.floor(ms / 60000);
    const horas = Math.floor(totalMinutos / 60);
    const minutos = totalMinutos % 60;
    return `${horas}h ${String(minutos).padStart(2, '0')}m`;
}

// Contabiliza e salva no Firebase o tempo decorrido desde a última mudança de estado
async function registrarTempoDecorrido(estadoQueTerminou) {
    const agora = Date.now();
    if (!ultimoEventoTimestamp) {
        await update(varalRef, { ultimo_evento: agora });
        return;
    }

    const duracaoMs = agora - ultimoEventoTimestamp;
    if (duracaoMs <= 0) return;

    const hojeKey = getDataKey();
    const diaRef = child(historicoRef, hojeKey);
    const snapshot = await get(diaRef);
    const registroDia = snapshot.val() || { aberto_ms: 0, fechado_ms: 0 };

    if (estadoQueTerminou === "ESTENDIDO") {
        registroDia.aberto_ms = (registroDia.aberto_ms || 0) + duracaoMs;
    } else {
        registroDia.fechado_ms = (registroDia.fechado_ms || 0) + duracaoMs;
    }

    await update(diaRef, registroDia);
    await update(varalRef, { ultimo_evento: agora });
    limparHistoricoAntigo();
}

// Mantém apenas 14 dias (7 da semana atual + 7 da semana anterior)
async function limparHistoricoAntigo() {
    const snapshot = await get(historicoRef);
    const todosDias = snapshot.val();
    if (!todosDias) return;

    const limiteMs = Date.now() - (14 * 24 * 60 * 60 * 1000);
    const dataLimiteKey = getDataKey(new Date(limiteMs));

    Object.keys(todosDias).forEach((dataKey) => {
        if (dataKey < dataLimiteKey) {
            remove(child(historicoRef, dataKey));
        }
    });
}

// Atualiza os números na tela (24h/Hoje, Semana Atual e Semana Anterior)
function atualizarPainelEstatisticas() {
    const agora = Date.now();
    const tempoAtivoAgora = ultimoEventoTimestamp ? (agora - ultimoEventoTimestamp) : 0;
    const hojeKey = getDataKey();

    // 1. Cálculo de Hoje (Período de 24h)
    const regHoje = dadosHistorico[hojeKey] || { aberto_ms: 0, fechado_ms: 0 };
    let abertoHoje = regHoje.aberto_ms || 0;
    let fechadoHoje = regHoje.fechado_ms || 0;

    if (estadoAtual === "ESTENDIDO") {
        abertoHoje += tempoAtivoAgora;
    } else {
        fechadoHoje += tempoAtivoAgora;
    }

    elAberto24h.textContent = formatarTempo(abertoHoje);
    elFechado24h.textContent = formatarTempo(fechadoHoje);

    // 2. Cálculo Semanal (Dias 0 a 6 = Semana Atual | Dias 7 a 13 = Semana Anterior)
    let semAtualAberto = 0, semAtualFechado = 0;
    let semAntAberto = 0, semAntFechado = 0;

    for (let i = 0; i < 14; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = getDataKey(d);
        const reg = dadosHistorico[key] || { aberto_ms: 0, fechado_ms: 0 };

        if (i < 7) {
            // Semana Atual (inclui o tempo correndo ao vivo de hoje)
            semAtualAberto += (i === 0) ? abertoHoje : (reg.aberto_ms || 0);
            semAtualFechado += (i === 0) ? fechadoHoje : (reg.fechado_ms || 0);
        } else {
            // Semana Anterior
            semAntAberto += (reg.aberto_ms || 0);
            semAntFechado += (reg.fechado_ms || 0);
        }
    }

    elSemAtualAberto.textContent = formatarTempo(semAtualAberto);
    elSemAtualFechado.textContent = formatarTempo(semAtualFechado);
    elSemAntAberto.textContent = formatarTempo(semAntAberto);
    elSemAntFechado.textContent = formatarTempo(semAntFechado);
}

// Escutar alterações em tempo real do nó 'varal'
onValue(varalRef, async (snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    const novoStatus = data.status || "ESTENDIDO";
    dadosHistorico = data.historico || {};

    // Se ainda não existe timestamp inicial, cria agora
    if (!data.ultimo_evento) {
        ultimoEventoTimestamp = Date.now();
        update(varalRef, { ultimo_evento: ultimoEventoTimestamp });
    } else {
        // Se o status mudou (ex: ESP32 recolheu por chuva ou concluiu comando), contabiliza o período anterior
        if (ultimoEventoTimestamp && novoStatus !== estadoAtual) {
            await registrarTempoDecorrido(estadoAtual);
        }
        ultimoEventoTimestamp = data.ultimo_evento;
    }

    estadoAtual = novoStatus;
    txtStatus.textContent = estadoAtual;
    txtStatus.style.color = estadoAtual === "RECOLHIDO" ? "#f59e0b" : "#22c55e";

    if (data.chuva) {
        txtSensor.textContent = "MOLHADO (Chuva)";
        txtSensor.style.color = "#ef4444";
    } else {
        txtSensor.textContent = "SECO";
        txtSensor.style.color = "#38bdf8";
    }

    checkAuto.checked = data.modo_auto !== false;

    if (estadoAtual === "ESTENDIDO") {
        btnToggle.textContent = "PUXAR VARAL (Recolher)";
        btnToggle.className = "btn-action btn-puxar";
    } else {
        btnToggle.textContent = "EMPURRAR VARAL (Estender)";
        btnToggle.className = "btn-action btn-empurrar";
    }

    atualizarPainelEstatisticas();
});

// Atualiza os contadores na tela a cada 10 segundos para manter os minutos sincronizados
setInterval(atualizarPainelEstatisticas, 10000);

// Enviar comando ao clicar no botão
btnToggle.addEventListener('click', () => {
    const novoComando = (estadoAtual === "ESTENDIDO") ? "PUXAR" : "EMPURRAR";
    btnToggle.textContent = "Enviando comando...";
    update(varalRef, { comando: novoComando });
});

// Alterar modo automático
checkAuto.addEventListener('change', (e) => {
    update(varalRef, { modo_auto: e.target.checked });
});

// Previsão do Tempo (Caxias do Sul)
async function carregarClima() {
    const lat = -29.1678;
    const lon = -51.1794;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,precipitation_probability,weather_code&timezone=America%2FSao_Paulo`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        const temp = Math.round(data.current.temperature_2m);
        const probChuva = data.current.precipitation_probability;
        const code = data.current.weather_code;

        document.getElementById('temp').textContent = `${temp}°C`;
        document.getElementById('rain-prob').textContent = `Chance de chuva: ${probChuva}%`;
        document.getElementById('weather-desc').textContent = interpretarCodigoClima(code);
    } catch (error) {
        document.getElementById('weather-desc').textContent = "Erro ao obter clima";
    }
}

function interpretarCodigoClima(code) {
    if (code === 0) return "Céu limpo";
    if (code <= 3) return "Parcialmente nublado";
    if (code >= 51 && code <= 67) return "Chuva leve a moderada";
    if (code >= 80) return "Pancadas de chuva";
    return "Nublado";
}

carregarClima();