// Datos estructurados de los 20 sectores extraídos del PDF
// "Matriz de Prospección B2B Ecuador" - Corporación Turingtech S.A.S.
window.SECTORES = [
  {
    id: "cooperativas",
    nombre: "Cooperativas de Ahorro y Crédito",
    icono: "🏦",
    cuentas: ["JEP", "Jardín Azuayo", "Policía Nacional Crédito", "Andalucía", "COAC Mushuc Runa", "COAC Oscus", "COAC Cacpe Yantzaza", "COAC Atuntaqui"],
    dolor: "Carpetas de crédito y ahorro construidas con documentación física o PDF dispersos. Validaciones de IESS, SRI y bienes raíces se realizan manualmente, retrasando desembolsos y generando riesgo operativo.",
    pilar: "IA (OCR + lectura inteligente) + RPA (robots de validación) + BI (tableros de riesgo y productividad)",
    decisor: "Gerente de Operaciones, Gerente de Riesgos o Director de Tecnología",
    cargosLinkedIn: ["Gerente de Operaciones", "Riesgos", "Crédito"],
    script: "Hola [Nombre], soy [Nombre] de TURINGTECH. Trabajamos con cooperativas de ahorro y crédito que reciben cientos de carpetas mensuales en PDF y Excel. Mediante OCR + IA leemos automáticamente los documentos y con RPA validamos IESS, SRI y bienes raíces. Un cliente similar redujo el tiempo de análisis de crédito de 5 días a 1. Le interesa una videollamada de 20 min para revisar si su operación puede lograr el mismo ahorro?"
  },
  {
    id: "importadoras",
    nombre: "Importadoras y Distribuidoras",
    icono: "📦",
    cuentas: ["Tomebamba", "Mareasa", "Indurama", "Autolasa", "Induauto", "Almacenes Estuardo Sánchez", "Corporación Jaher", "Plastigama"],
    dolor: "Conciliación de importaciones (DAU, SRI, pólizas) requiere reingreso manual entre el ERP y portales del Estado. La toma de pedidos en calle depende de WhatsApp, llamadas o hojas impresas.",
    pilar: "RPA (robots de conciliación) + Software a la Medida (app de pedidos/cobros) + BI (tableros de ventas e inventario)",
    decisor: "Gerente de Supply Chain, CFO o Gerente Comercial",
    cargosLinkedIn: ["Supply Chain", "Logística", "CFO", "Comercial"],
    script: "Hola [Nombre], me dirijo a usted porque en distribuidoras como [Empresa] vemos que el equipo de comercial y operaciones pierde horas conciliando importaciones y consolidando pedidos del día. Hemos desarrollado robots RPA para DAU/SRI y aplicaciones móviles de pedidos que se integran con el ERP. Tiene 20 min esta semana para ver si su caso encaja?"
  },
  {
    id: "logistica",
    nombre: "Logística y Transporte",
    icono: "🚚",
    cuentas: ["Urbano", "Servientrega", "Empresas de carga pesada y transporte local", "Latam Cargo Ecuador", "Farmaenlace Logística", "Translogistic"],
    dolor: "Generación masiva y validación de guías de remisión ante el SRI. Falta de trazabilidad en tiempo real de flotas y entregas.",
    pilar: "RPA (emisión y validación de guías) + Desarrollo a la Medida (portal de operaciones y rastreo)",
    decisor: "Gerente de Logística, Gerente de Operaciones o Director de Transporte",
    cargosLinkedIn: ["Logística", "Operaciones", "Flota"],
    script: "Hola [Nombre], soy [Nombre] de TURINGTECH. En operadoras logísticas del Ecuador hemos automatizado la emisión y validación masiva de guías de remisión ante el SRI, y hemos construido portales de rastreo propios que eliminan la dependencia de plataformas pagas por licencia. Me gustaría mostrarle en 20 min cómo se aplica a su flota. Le queda bien este martes o jueves?"
  },
  {
    id: "salud",
    nombre: "Salud, Farmacias y Laboratorios",
    icono: "🏥",
    cuentas: ["Grupo Difare", "GPF", "Cadenas de farmacias y laboratorios", "Farmaenlace (Farmacias Económicas/Medicity)", "Grupo Hospitalario Kennedy"],
    dolor: "Validación manual de facturas de proveedores, entradas y salidas de inventario, y quiebres de stock por falta de predicción. Cumplimiento de cadena de frío y trazabilidad.",
    pilar: "IA (lectura y validación automática de facturas de proveedores) + BI (predicción de inventarios y rotación)",
    decisor: "Director de TI, Gerente de Operaciones o Director de Compras",
    cargosLinkedIn: ["TI", "Operaciones", "Compras", "Supply"],
    script: "Hola [Nombre], le escribo porque en empresas del sector salud procesamos miles de facturas de proveedores con IA y OCR, eliminando el tecleo manual y los errores de clasificación. Además, montamos tableros de BI que predicen quiebres de stock y rotación por punto de venta. Podemos agendar 20 min para revisar si este ahorro es aplicable a su cadena?"
  },
  {
    id: "agroindustria",
    nombre: "Agroindustria, Acuacultura y Exportación",
    icono: "🌾",
    cuentas: ["Santa Priscila", "Nirsa", "Reybanpac", "La Fabril", "Agrocoex", "Omarsa", "Expalsa", "Danec S.A.", "Aglomerados Cotopaxi"],
    dolor: "Liquidación manual de piscinas y fincas, registro de producción en papel o Excel, y ensamblaje de carpetas de exportación para SENAE y Agrocalidad. Falta de trazabilidad desde el cultivo/piscina hasta el contenedor.",
    pilar: "BI (tableros de producción, rendimiento y costos) + RPA (validaciones SENAE/Agrocalidad) + App Móvil Offline (registro de campo sin conectividad)",
    decisor: "Gerente de Operaciones Agrícolas, Gerente de Exportaciones o Director de TI",
    cargosLinkedIn: ["Operaciones Agrícolas", "Exportaciones", "TI"],
    script: "Hola [Nombre], soy [Nombre] de TURINGTECH. En empresas agroindustriales y acuícolas del Ecuador hemos automatizado la liquidación diaria de piscinas y fincas, conectando datos de campo con SENAE y Agrocalidad para exportación. Además, desarrollamos apps móviles offline que funcionan sin internet y tableros de BI en tiempo real. Le queda 20 min esta semana para revisar su caso?"
  },
  {
    id: "manufactura",
    nombre: "Manufactura y Consumo Masivo",
    icono: "🏭",
    cuentas: ["Pronaca", "Moderna Alimentos", "Arca Continental", "Cervecería Nacional", "Alpina", "Novopan del Ecuador", "Pasteurizadora Quito", "Nestlé Ecuador", "Tonicorp"],
    dolor: "Conciliación de facturas, notas de crédito y descuentos con cadenas de supermercados (Favorita, Tía). Control manual de mermas, faltantes y devoluciones. Falta de trazabilidad por lote.",
    pilar: "RPA (conciliación masiva con cadenas) + IA (lectura y clasificación de notas de crédito) + BI (mermas, rotación y cumplimiento comercial)",
    decisor: "Gerente de Planta, Gerente de Supply Chain, CFO o Director de TI",
    cargosLinkedIn: ["Planta", "Supply Chain", "CFO", "TI"],
    script: "Hola [Nombre], me dirijo a usted porque en manufactura de consumo masivo vemos que el equipo de crédito y cobranzas pierde días conciliando facturas y notas de crédito con cadenas como Favorita y Tía, además de controlar mermas. Con RPA + IA logramos conciliar automáticamente y con BI medimos mermas en tiempo real. Tiene 20 min para conversar?"
  },
  {
    id: "construccion",
    nombre: "Construcción e Inmobiliarias Grandes",
    icono: "🏗️",
    cuentas: ["Holcim Ecuador", "Novacero", "Kubiec", "Sedemi", "Uribe Schwarzkopf"],
    dolor: "Control presupuestario y de costos en Excel con múltiples versiones. Planillas de subcontratistas, avance de obra y certificados de pago se consolidan manualmente. Desviaciones se detectan tarde.",
    pilar: "Software a la Medida (control de obra, subcontratistas y presupuesto) + BI (tableros de avance, costo y rentabilidad)",
    decisor: "Director de Proyectos, Gerente de Construcción, CFO o Director de TI",
    cargosLinkedIn: ["Director de Proyectos", "Construcción", "CFO", "TI"],
    script: "Hola [Nombre], soy [Nombre] de TURINGTECH. Trabajamos con constructoras e inmobiliarias que administran presupuestos y subcontratistas en Excel disperso. Construimos software a la medida para control de obras y tableros de BI que previenen desviaciones antes de que ocurran. Le interesa una videollamada de 20 min?"
  },
  {
    id: "automotrices",
    nombre: "Concesionarios Automotrices y Ensambladoras",
    icono: "🚗",
    cuentas: ["Casabaca", "Automotores y Anexos", "Neohyundai", "Maresa", "Omnibus BB"],
    dolor: "Checklist manual en talleres de posventa, control de garantías, repuestos y tiempos de entrega. Reportes operativos exigidos por casas matrices requieren reingreso manual en DMS o Excel.",
    pilar: "Software a la Medida (app de control de taller y checklist) + RPA (generación y envío de reportes a casas matrices)",
    decisor: "Gerente de Posventa, Gerente de Operaciones o Director de Servicio",
    cargosLinkedIn: ["Posventa", "Operaciones", "Servicio"],
    script: "Hola [Nombre], le escribo porque en concesionarios y ensambladoras del Ecuador hemos desarrollado apps para el control de talleres de posventa, checklists de recepción y entrega, y RPA para generar reportes exigidos por casas matrices. Todo integrado con el DMS. Podemos agendar 20 min para mostrarle el caso?"
  },
  {
    id: "educacion",
    nombre: "Educación Superior y Universidades Grandes",
    icono: "🎓",
    cuentas: ["USFQ", "UDLA", "PUCE", "UTPL", "UEES"],
    dolor: "Documentos de admisiones manuales, validación de títulos con SENESCYT, conciliación de pensiones y matrículas con el SRI, y falta de tableros que midan deserción por carrera o cohorte.",
    pilar: "IA (OCR para documentos de admisiones y SENESCYT) + RPA (cobros, pensiones y validaciones SRI) + BI (predicción de deserción y rendimiento académico)",
    decisor: "CIO, Director de Admisiones, CFO o Director de Tecnología",
    cargosLinkedIn: ["CIO", "Director de Admisiones", "CFO", "Tesorería"],
    script: "Hola [Nombre], soy [Nombre] de TURINGTECH. En universidades del Ecuador hemos automatizado el procesamiento de documentos de admisiones con OCR + IA, validados con SENESCYT, y con RPA conciliamos masivamente las pensiones con el SRI. Además, nuestros tableros de BI ayudan a predecir deserción por carrera. Le interesa una videollamada de 20 min?"
  },
  {
    id: "retail",
    nombre: "Retail Grande, Franquicias y Cadenas de Tiendas",
    icono: "🛍️",
    cuentas: ["Corporación El Rosado", "De Prati", "Marathon Sports", "Juan Eljuri", "ETA Fashion", "Almacenes Boyacá", "Almacenes Estuardo Sánchez"],
    dolor: "Inventario desfasado entre POS, e-commerce y marketplaces. Conciliación manual de cajas, devoluciones y notas de crédito. Falta de visibilidad de rentabilidad por tienda y canal.",
    pilar: "RPA (conciliación de ventas y devoluciones) + Software a la Medida (sincronización POS/e-commerce) + BI Retail (rotación, stock y rentabilidad por canal)",
    decisor: "CTO, Gerente de Operaciones Retail, CFO o Jefe de Supply",
    cargosLinkedIn: ["CTO", "Operaciones Retail", "CFO", "Supply"],
    script: "Hola [Nombre], me dirijo a usted porque en retail vemos que el POS, el e-commerce y los marketplaces no sincronizan existencias en tiempo real, generando ventas perdidas y devoluciones difíciles de conciliar. Construimos software a la medida y RPA para sincronizar canales, y BI retail para medir rotación por tienda. Tiene 20 min para revisar?"
  },
  {
    id: "aseguradoras",
    nombre: "Aseguradoras y Medicina Prepagada",
    icono: "🛡️",
    cuentas: ["Saludsa", "Ecuasanitas", "Humana", "Seguros Equinoccial", "Chubb Ecuador"],
    dolor: "Procesamiento manual masivo de reembolsos de gastos médicos: lectura de facturas, recetas, certificados y validación con el SRI. Retrasos en liquidación y errores de clasificación.",
    pilar: "IA (OCR de facturas médicas y recetas) + RPA (carga al core asegurador) + BI (siniestralidad, costo por póliza y fraude)",
    decisor: "Gerente de Reembolsos, Gerente de Operaciones, Director de TI o CFO",
    cargosLinkedIn: ["Reembolsos", "Operaciones", "TI", "CFO"],
    script: "Hola [Nombre], le escribo porque en aseguradoras procesamos miles de reembolsos de gastos médicos con IA y OCR, leyendo automáticamente facturas, recetas y certificados para el pago. Además, RPA alimenta el core asegurador y BI mide siniestralidad por red. Podemos agendar 20 min?"
  },
  {
    id: "turismo",
    nombre: "Turismo, Hospitalidad de Alto Nivel y Operadores",
    icono: "🏨",
    cuentas: ["Oro Verde Hotels", "Decameron", "Hotel Colón Hilton", "JW Marriott", "Metropolitan Touring"],
    dolor: "Conciliación diaria de comisiones y reservas de OTAs (Booking, Expedia) con bancos y SRI. Logística de tours, traslados y disponibilidad centralizada. Falta de tableros RevPAR y ocupación.",
    pilar: "RPA (conciliación de comisiones OTAs y pagos) + Software a la Medida (operador logístico y reservas) + BI (RevPAR, ocupación y rentabilidad por canal)",
    decisor: "Gerente de Operaciones, CFO, Director de Sistemas o Revenue Manager",
    cargosLinkedIn: ["Operaciones", "CFO", "Director de Sistemas", "Revenue Manager"],
    script: "Hola [Nombre], soy [Nombre] de TURINGTECH. En hoteles y operadores turísticos del Ecuador automatizamos la conciliación diaria de comisiones de OTAs como Booking y Expedia con bancos y SRI, y construimos tableros de BI sobre RevPAR, ocupación y rentabilidad por tour. Le queda 20 min para conversar?"
  },
  {
    id: "mineria",
    nombre: "Minería, Servicios Petroleros y Energía (Oil & Gas)",
    icono: "⛏️",
    cuentas: ["Lundin Gold", "EcuaCorriente", "SLB", "Baker Hughes", "Halliburton", "Petroia"],
    dolor: "Acreditación y control de contratistas/HSE, inventario offline en campamentos y planillas. Falta de trazabilidad de Opex/Capex por proyecto y campamento.",
    pilar: "Software a la Medida (Portal HSE, App Campo offline y control de contratistas) + BI (Opex, Capex y productividad por proyecto)",
    decisor: "Gerente de Operaciones, Gerente de Supply Chain, Gerente HSE, CFO o Director de TI",
    cargosLinkedIn: ["Operaciones", "HSE", "Supply Chain", "CFO"],
    script: "Hola [Nombre], soy [Nombre] de TURINGTECH. En minería y oil & gas del Ecuador hemos desarrollado portales HSE y apps de campo offline que centralizan la acreditación de contratistas, el control de equipos y la liquidación de planillas. Además, nuestros tableros de BI miden Opex y Capex por campamento y proyecto. Le interesa una reunión de 20 min?"
  },
  {
    id: "telecom",
    nombre: "Telecomunicaciones, ISPs Regionales y Servicios de TI",
    icono: "📡",
    cuentas: ["Netlife", "Puntonet", "Celerity", "Xtrim", "Telconet"],
    dolor: "Conciliación masiva de cobros con bancos y SRI, ruteo manual de técnicos en calle y falta de tableros de churn y retención por canal.",
    pilar: "RPA (conciliación de cobros y bancos) + Software a la Medida (app de ruteo de técnicos) + BI (churn, retención y rentabilidad por plan)",
    decisor: "COO, CTO, Gerente de Campo, CFO o Director de TI",
    cargosLinkedIn: ["COO", "CTO", "Gerente de Campo", "CFO"],
    script: "Hola [Nombre], le escribo porque en ISPs y telecomunicaciones vemos que el cobro masivo se concilia manualmente con bancos y SRI, y los técnicos en calle dependen de llamadas o hojas impresas. Con RPA, apps de ruteo y BI de churn hemos reducido el esfuerzo administrativo y mejorado la retención. Tiene 20 min?"
  },
  {
    id: "portuarios",
    nombre: "Operadores Portuarios, Concesiones Aeroportuarias y Zonas Francas",
    icono: "🚢",
    cuentas: ["Quiport", "TAGSA", "Contecon Guayaquil", "DP World Posorja", "Yilport", "Terminal Portuario de Manta (TPM)", "Terminal Terrestre de Guayaquil"],
    dolor: "Conciliación de tarifas con SENAE, agentes aduaneros y control de permanencia de carga. Múltiples versiones de cálculo de tarifas y recargos en Excel.",
    pilar: "RPA (conciliación con SENAE y agentes) + Software a la Medida (tarifas y control de permanencia) + BI (productividad y recaudación)",
    decisor: "Gerente de Operaciones, CTO, CFO o Gerente de Comercio Exterior",
    cargosLinkedIn: ["Operaciones", "CTO", "CFO", "Comercio Exterior"],
    script: "Hola [Nombre], soy [Nombre] de TURINGTECH. En puertos, aeropuertos y zonas francas hemos automatizado la conciliación de tarifas con SENAE, agentes aduaneros y el control de permanencia de carga. Con RPA, software a la medida y BI medimos productividad y recaudación en tiempo real. Le queda 20 min?"
  },
  {
    id: "entretenimiento",
    nombre: "Entretenimiento, Cines, Ticketing y Gimnasios",
    icono: "🎬",
    cuentas: ["Multicines", "Supercines", "Feel The Tickets", "Phisique", "Smart Fit Ecuador"],
    dolor: "Picos de facturación SRI en preventas de entradas y eventos, cobranza recurrente de membresías y falta de visibilidad de retención y rentabilidad por sede.",
    pilar: "RPA (facturación masiva SRI en picos) + BI (MRR, retención, ticket promedio y rentabilidad por sede)",
    decisor: "Director de TI, Gerente de Operaciones, CFO o Revenue Manager",
    cargosLinkedIn: ["Director de TI", "Operaciones", "CFO", "Revenue Manager"],
    script: "Hola [Nombre], me dirijo a usted porque en cines, ticketing y gimnasios manejan picos de facturación en preventas y cobranza recurrente de membresías. Con RPA emitimos y conciliamos facturas masivamente con el SRI, y con BI medimos MRR, retención y rentabilidad por sede. Podemos agendar 20 min?"
  },
  {
    id: "seguridad",
    nombre: "Seguridad Privada, Transporte de Valores y Mantenimiento",
    icono: "🔒",
    cuentas: ["Tevcol", "Prosegur Ecuador", "G4S Ecuador", "Liderman", "SEPSeguridad"],
    dolor: "Marcación y asistencia de guardias en campo con formatos impresos o fotos de WhatsApp. Nómina compleja con horas nocturnas, extras, feriados y múltiples puntos de servicio.",
    pilar: "Software a la Medida (App de marcación georreferenciada y control de turnos) + RPA (nómina) + BI (cobertura, ausentismo y costos por punto)",
    decisor: "Gerente de Operaciones, Director de RRHH, CFO o Director de TI",
    cargosLinkedIn: ["Operaciones", "RRHH", "CFO", "TI"],
    script: "Hola [Nombre], soy [Nombre] de TURINGTECH. En empresas de seguridad y transporte de valores hemos desarrollado apps de marcación georreferenciada para guardias en campo y RPA para calcular nóminas con turnos nocturnos, extras y feriados. Con BI medimos cobertura y costos por punto. Tiene 20 min para ver su caso?"
  },
  {
    id: "bpo",
    nombre: "BPO, Contact Centers y Servicios Administrados",
    icono: "📞",
    cuentas: ["Teleperformance Ecuador", "Digitex", "Atento Ecuador", "Apex America", "Konecta"],
    dolor: "Conciliación de horas operativas vs. facturación a clientes, generación manual de reportes de campaña y falta de visibilidad de rentabilidad por cliente/campaña.",
    pilar: "RPA (conciliación horas/facturación y ERP/SRI) + BI (rentabilidad por campaña, cliente y agente)",
    decisor: "COO, CFO, Director de TI o Gerente de Operaciones",
    cargosLinkedIn: ["COO", "CFO", "Director de TI", "Operaciones"],
    script: "Hola [Nombre], le escribo porque en BPO y contact centers el equipo de operaciones pierde días conciliando horas productivas contra facturación a clientes y generando reportes de campaña. Con RPA y BI medimos rentabilidad por campaña y cliente en tiempo real. Podemos agendar 20 min?"
  },
  {
    id: "microfinancieras",
    nombre: "Microfinancieras, Sociedades Financieras y Tarjetas",
    icono: "💳",
    cuentas: ["Diners Club Ecuador", "Banco Solidario", "Banco D-MIRO", "Credife", "Deuna"],
    dolor: "Validación manual de solicitudes de crédito/consumo, lectura de documentos de ingresos y conciliación de vouchers con comercios. Morosidad y riesgo medidos con retraso.",
    pilar: "IA (OCR de documentos de ingresos) + RPA (validaciones SRI, riesgos y conciliación de vouchers) + BI (morosidad, riesgo y rentabilidad por producto)",
    decisor: "Gerente de Operaciones, Director de Riesgos, CTO o CFO",
    cargosLinkedIn: ["Operaciones", "Riesgos", "CTO", "CFO"],
    script: "Hola [Nombre], soy [Nombre] de TURINGTECH. Trabajamos con microfinancieras y emisores de tarjetas para leer con OCR + IA documentos de ingresos, validar riesgos y conciliar vouchers con comercios. También usamos RPA para validaciones SRI y BI para medir morosidad y riesgo. Le interesa una reunión de 20 min?"
  },
  {
    id: "medios",
    nombre: "Medios de Comunicación, Agencias y Grupos Editoriales",
    icono: "📰",
    cuentas: ["Teleamazonas", "Ecuavisa", "Diario El Universo", "Grupo El Comercio", "OMD Ecuador"],
    dolor: "Certificación manual de pauta emitida frente a órdenes de compra, comisiones de agencia y conciliación de inventario publicitario. Falta de tableros de ocupación y rentabilidad por canal.",
    pilar: "RPA (conciliación pauta/SRI y comisiones) + BI (ocupación de inventario publicitario y rentabilidad por medio/campaña)",
    decisor: "CFO, Gerente de Operaciones, Director de Sistemas o Media Manager",
    cargosLinkedIn: ["CFO", "Operaciones", "Director de Sistemas", "Media Manager"],
    script: "Hola [Nombre], me dirijo a usted porque en medios, agencias y grupos editoriales certificar la pauta emitida frente a órdenes de compra y comisiones de agencia suele ser manual. Con RPA conciliamos pauta, SRI y comisiones, y con BI medimos ocupación de inventario publicitario. Tiene 20 min?"
  }
];

// Patrones de correo corporativo ecuatoriano (Fase 2 del SOP)
window.PATRONES_EMAIL = [
  "nombre.apellido@dominio.com.ec",
  "n.apellido@dominio.com.ec",
  "nombre@dominio.com.ec",
  "gerencia.operaciones@dominio.com.ec",
  "gerente.operaciones@dominio.com.ec"
];

// Ejemplos de patrones reales por empresa
window.EJEMPLOS_EMAIL = [
  { empresa: "JEP", patron: "nombre.apellido@jep.ec" },
  { empresa: "Mareasa", patron: "nombre.apellido@mareasa.com" },
  { empresa: "Servientrega", patron: "nombre.apellido@servientrega.com.ec" },
  { empresa: "Difare", patron: "nombre.apellido@difare.com.ec" }
];

// Fases del SOP de Inteligencia e Investigación de Contactos
window.FASES_SOP = [
  { id: 1, nombre: "Fase 1: Búsqueda LinkedIn", desc: "Identificar empresa, buscar en LinkedIn, aplicar filtros de cargo y extraer nombre, cargo y link. No enviar conexión todavía." },
  { id: 2, nombre: "Fase 2: Correo corporativo", desc: "Identificar dominio, aplicar patrones de correo ecuatoriano y validar existencia. Descartar correos genéricos info@." },
  { id: 3, nombre: "Fase 3: Confirmación PBX", desc: "Localizar central, llamar a PBX, pedir contacto o asistente, registrar extensión y correo confirmado." },
  { id: 4, nombre: "Fase 4: Higiene y CRM", desc: "Verificar formato, asignar pilar inicial y programar primera cadencia del SOP Outbound." }
];

// Pilares vendibles por Turingtech
window.PILARES = ["RPA", "IA", "BI", "Software a la Medida", "App Móvil Offline"];

// Fuentes de origen del contacto
window.FUENTES = ["LinkedIn", "PBX", "Referido"];
