/**
 * Regras primárias do sistema — pré-cadastradas, somente leitura.
 * Regras criadas pelo usuário sempre têm prioridade sobre estas.
 */

export interface PrimaryCategoryRule {
  id: string;
  name: string;
  matchValue: string; // termos separados por vírgula
  category: string;
  isActive: boolean;
}

export const PRIMARY_CATEGORY_RULES: PrimaryCategoryRule[] = [
  {
    id: "primary-cat-1",
    name: "Combustível",
    matchValue: "posto, ipiranga, shell, petrobras, petrobrás, br distribuidora, ale combustiveis, ale combustíveis, gas station, posto fera, fera, posto canário, canário, posto simon, simon",
    category: "Combustível",
    isActive: true,
  },
  {
    id: "primary-cat-2",
    name: "Supermercado",
    matchValue: "mercado, supermercado, atacadão, atacadao, assai, assai atacadista, carrefour, big, giassi, fort atacadista, angeloni, condor, hiper, zafari, longo, tieli, althoff, komprão, komprao, mape",
    category: "Supermercado",
    isActive: true,
  },
  {
    id: "primary-cat-3",
    name: "Restaurante",
    matchValue: "restaurante, churrascaria, grill, food, cia do suco, praça di anita, pardhals",
    category: "Restaurante",
    isActive: true,
  },
  {
    id: "primary-cat-4",
    name: "Lanche",
    matchValue: "pizzaria, pizza, burger, hamburger, hamburguer, hamburgueria, hamburgeria, lancheria, bistro, bistrô, lanche, snack, fast food, fastfood, mini kalzone, piazza",
    category: "Lanche",
    isActive: true,
  },
  {
    id: "primary-cat-5",
    name: "Padaria",
    matchValue: "padaria, panificadora, bakery, café, cafe, cafeteria, doceria, confeitaria, padeirinho, gisele",
    category: "Padaria",
    isActive: true,
  },
  {
    id: "primary-cat-6",
    name: "Delivery",
    matchValue: "ifood, rappi, uber eats, ubereats, aiqfome, delivery, entrega, mais delivery",
    category: "Delivery",
    isActive: true,
  },
  {
    id: "primary-cat-7",
    name: "Uber / Táxi",
    matchValue: "uber, 99app, 99pop, 99taxi, 99 taxi, taxi, táxi, cabify",
    category: "Uber / Táxi",
    isActive: true,
  },
  {
    id: "primary-cat-8",
    name: "Transporte público",
    matchValue: "onibus, ônibus, metro, metrô, trem, bilhete unico, bilhete único, transporte publico, transporte público",
    category: "Transporte público",
    isActive: true,
  },
  {
    id: "primary-cat-9",
    name: "Streaming",
    matchValue: "netflix, spotify, amazon prime, prime video, disney, disney+, hbo, hbo max, youtube premium, globoplay, deezer",
    category: "Streaming",
    isActive: true,
  },
  {
    id: "primary-cat-10",
    name: "Internet / TV / Telefone",
    matchValue: "vivo, claro, tim, oi, internet, banda larga, telefonia, operadora, fibra",
    category: "Internet / TV / Telefone",
    isActive: true,
  },
  {
    id: "primary-cat-11",
    name: "Assinatura",
    matchValue: "subscription, assinatura, mensalidade, recurring, plano mensal",
    category: "Assinatura",
    isActive: true,
  },
  {
    id: "primary-cat-12",
    name: "Farmácia",
    matchValue: "farmacia, farmácia, farma, drogaria, droga raia, drogasil, pague menos, panvel",
    category: "Farmácia",
    isActive: true,
  },
  {
    id: "primary-cat-13",
    name: "Plano de saúde",
    matchValue: "unimed, amil, bradesco saude, bradesco saúde, hapvida, sulamerica, sulamérica, plano de saude, plano de saúde, celos",
    category: "Plano de saúde",
    isActive: true,
  },
  {
    id: "primary-cat-14",
    name: "Consulta / Exame",
    matchValue: "clinica, clínica, laboratorio, laboratório, exame, consulta, medico, médico, hospital",
    category: "Consulta / Exame",
    isActive: true,
  },
  {
    id: "primary-cat-15",
    name: "Escola / Faculdade",
    matchValue: "escola, faculdade, universidade, curso, colegio, colégio, mensalidade escolar",
    category: "Escola / Faculdade",
    isActive: true,
  },
  {
    id: "primary-cat-16",
    name: "Cursos",
    matchValue: "udemy, alura, curso, treinamento, workshop, ebac",
    category: "Cursos",
    isActive: true,
  },
  {
    id: "primary-cat-17",
    name: "Eletrônicos",
    matchValue: "amazon, mercadolivre, mercado livre, kabum, magazine luiza, magalu, loja de eletronicos, eletrônicos",
    category: "Eletrônicos",
    isActive: true,
  },
  {
    id: "primary-cat-18",
    name: "Roupas / Calçados",
    matchValue: "renner, riachuelo, cea, c&a, zara, hering, loja de roupas, calcados, calçados",
    category: "Roupas / Calçados",
    isActive: true,
  },
  {
    id: "primary-cat-19",
    name: "Pet",
    matchValue: "petshop, pet shop, veterinario, veterinário, ração, petz, cobasi, nativa, vital",
    category: "Pet",
    isActive: true,
  },
  {
    id: "primary-cat-20",
    name: "Estacionamento",
    matchValue: "estacionamento, parking, zona azul, rotativo",
    category: "Estacionamento",
    isActive: true,
  },
  {
    id: "primary-cat-21",
    name: "Condomínio",
    matchValue: "condominio, condomínio, taxa condominial",
    category: "Condomínio",
    isActive: true,
  },
  {
    id: "primary-cat-22",
    name: "Aluguel",
    matchValue: "aluguel, locacao, locação, imobiliaria, imobiliária",
    category: "Aluguel",
    isActive: true,
  },
  {
    id: "primary-cat-23",
    name: "Água / Luz / Gás",
    matchValue: "energia, luz, agua, água, saneamento, gás, gas, cemig, celesc, sabesp",
    category: "Água / Luz / Gás",
    isActive: true,
  },
  {
    id: "primary-cat-24",
    name: "Imposto / Taxa",
    matchValue: "iptu, ipva, taxa, imposto, receita federal, darf",
    category: "Imposto / Taxa",
    isActive: true,
  },
  {
    id: "primary-cat-25",
    name: "Viagem / Hotel",
    matchValue: "hotel, pousada, booking, airbnb, trip, decolar, 123milhas, expedia",
    category: "Viagem / Hotel",
    isActive: true,
  },
  {
    id: "primary-cat-26",
    name: "Cinema / Teatro",
    matchValue: "cinema, ingresso, ingressos, teatro, cinemark, uci",
    category: "Cinema / Teatro",
    isActive: true,
  },
  {
    id: "primary-cat-27",
    name: "Investimento",
    matchValue: "xp investimentos, rico, clear, nubank investimentos, inter investimentos, aplicacao, aplicação, tesouro direto",
    category: "Investimento",
    isActive: true,
  },
];
