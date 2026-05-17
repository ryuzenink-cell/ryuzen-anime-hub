const guides = [
  ["Animes parecidos com Re:Zero", "Protagonistas quebrados, fantasia sombria e loops emocionais para quem gosta de tensão."],
  ["Por onde começar nos isekais?", "Um guia de entrada para mundos paralelos, reencarnações e aventuras de portal."],
  ["Animes curtos para assistir em um fim de semana", "Obras fechadas, episódios enxutos e boas histórias sem compromisso longo."],
  ["Animes para quem está estudando japonês", "Sugestões com vocabulário cotidiano, diálogos claros e temas fáceis de acompanhar."],
  ["Melhores animes de fantasia para começar", "Magia, guildas, jornadas e mundos ricos para montar sua primeira lista."],
  ["Ordem para assistir grandes franquias", "Como navegar especiais, filmes e temporadas sem se perder na cronologia."]
];

const guidesGrid = document.getElementById("guidesGrid");
const upcomingGuideUrl = sitePath("guides/proximos-animes/");

guidesGrid.innerHTML = `
  <a class="guide-card guide-card-featured" href="${upcomingGuideUrl}">
    <div>
      <p class="eyebrow">Guia fixo • Atualização automática</p>
      <h3>Próximos animes confirmados</h3>
      <p>Lista viva com animes já cadastrados como futuros lançamentos, datas previstas, tipos, status e links para detalhes.</p>
    </div>
    <span class="badge score">Ver agenda</span>
  </a>
  ${guides.map(([title, text]) => `
    <article class="guide-card">
      <p class="eyebrow">Guia Ryuzen</p>
      <h3>${title}</h3>
      <p>${text}</p>
      <span class="badge warn">Em breve</span>
    </article>
  `).join("")}
`;
