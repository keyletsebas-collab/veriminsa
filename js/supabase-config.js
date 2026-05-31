/* =============================================
   SUPABASE-CONFIG.JS – Client Initialization
   ============================================= */

const supabaseUrl = "https://qcudymexssvfdeppkhjs.supabase.co";
const supabaseKey = "sb_publishable_y1Wj-5PSHOIN-_pIvX5Xeg_6SjpvjpF";

let supabaseClient = null;
let isSupabaseActive = false;

try {
    if (typeof supabase !== 'undefined' && typeof supabase.createClient === 'function') {
        supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);
        isSupabaseActive = true;
        console.log("🚀 Veriminsa SupabaseClient inicializado correctamente.");
    } else {
        console.warn("⚠️ SDK de Supabase no cargado aún. Se esperará la carga de la biblioteca.");
        window.addEventListener('DOMContentLoaded', () => {
            if (typeof supabase !== 'undefined' && typeof supabase.createClient === 'function') {
                supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);
                isSupabaseActive = true;
                console.log("🚀 Veriminsa SupabaseClient inicializado en DOMContentLoaded.");
            }
        });
    }
} catch (err) {
    console.error("❌ Error CRÍTICO conectando a Supabase en Veriminsa:", err);
}
