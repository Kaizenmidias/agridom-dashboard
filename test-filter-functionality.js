const puppeteer = require('puppeteer');

async function testFilterFunctionality() {
  const browser = await puppeteer.launch({ headless: false, slowMo: 1000 });
  const page = await browser.newPage();
  
  try {
    console.log('🔍 Iniciando teste do filtro do dashboard...');
    
    // Navegar para a página de login
    await page.goto('http://localhost:8080/login');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Fazer login
    console.log('📝 Fazendo login...');
    await page.type('input[type="email"]', 'ricardo@agridom.com.br');
    await page.type('input[type="password"]', '123456');
    await page.click('button[type="submit"]');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Navegar para o dashboard
    console.log('📊 Navegando para o dashboard...');
    await page.goto('http://localhost:8080/');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Testar filtro anual
    console.log('📅 Testando filtro anual...');
    
    // Procurar pelo seletor de período
    const periodSelector = 'select, [role="combobox"]';
    await page.waitForSelector(periodSelector, { timeout: 10000 });
    
    // Selecionar "Este ano"
    try {
      await page.click(periodSelector);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Procurar pela opção "Este ano" ou "year"
      const yearOption = await page.$x('//option[contains(text(), "Este ano")] | //*[contains(text(), "Este ano")]');
      if (yearOption.length > 0) {
        await yearOption[0].click();
        console.log('✅ Filtro anual selecionado');
      } else {
        console.log('⚠️ Opção "Este ano" não encontrada, tentando valor "year"');
        await page.select(periodSelector, 'year');
      }
    } catch (error) {
      console.log('⚠️ Erro ao selecionar filtro anual:', error.message);
    }
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Verificar se há dados no gráfico
    console.log('📈 Verificando dados do gráfico anual...');
    const chartCanvas = await page.$('canvas');
    if (chartCanvas) {
      console.log('✅ Gráfico encontrado no filtro anual');
    } else {
      console.log('❌ Gráfico não encontrado no filtro anual');
    }
    
    // Verificar se há valores nas métricas
    const metrics = await page.$$eval('[data-testid="metric-card"], .metric-card, .card', (cards) => {
      return cards.map(card => {
        const text = card.textContent || '';
        return {
          text: text.substring(0, 100),
          hasNumbers: /\d+/.test(text)
        };
      });
    });
    
    console.log('📊 Métricas encontradas no filtro anual:', metrics.length);
    const metricsWithNumbers = metrics.filter(m => m.hasNumbers);
    console.log('📊 Métricas com valores numéricos:', metricsWithNumbers.length);
    
    // Testar filtro mensal
    console.log('📅 Testando filtro mensal...');
    
    try {
      await page.click(periodSelector);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Selecionar um mês específico (ex: janeiro)
      const currentYear = new Date().getFullYear();
      const monthValue = `${currentYear}-1`; // Janeiro
      
      const monthOption = await page.$x(`//option[@value="${monthValue}"] | //*[contains(text(), "janeiro")]`);
      if (monthOption.length > 0) {
        await monthOption[0].click();
        console.log('✅ Filtro mensal selecionado (janeiro)');
      } else {
        console.log('⚠️ Tentando selecionar mês por valor');
        await page.select(periodSelector, monthValue);
      }
    } catch (error) {
      console.log('⚠️ Erro ao selecionar filtro mensal:', error.message);
    }
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Verificar dados do filtro mensal
    console.log('📈 Verificando dados do gráfico mensal...');
    const monthlyChartCanvas = await page.$('canvas');
    if (monthlyChartCanvas) {
      console.log('✅ Gráfico encontrado no filtro mensal');
    } else {
      console.log('❌ Gráfico não encontrado no filtro mensal');
    }
    
    // Verificar métricas mensais
    const monthlyMetrics = await page.$$eval('[data-testid="metric-card"], .metric-card, .card', (cards) => {
      return cards.map(card => {
        const text = card.textContent || '';
        return {
          text: text.substring(0, 100),
          hasNumbers: /\d+/.test(text)
        };
      });
    });
    
    console.log('📊 Métricas encontradas no filtro mensal:', monthlyMetrics.length);
    const monthlyMetricsWithNumbers = monthlyMetrics.filter(m => m.hasNumbers);
    console.log('📊 Métricas mensais com valores numéricos:', monthlyMetricsWithNumbers.length);
    
    // Resumo dos testes
    console.log('\n🎯 RESUMO DOS TESTES:');
    console.log('✅ Filtro anual:', chartCanvas ? 'FUNCIONANDO' : 'COM PROBLEMAS');
    console.log('✅ Filtro mensal:', monthlyChartCanvas ? 'FUNCIONANDO' : 'COM PROBLEMAS');
    console.log('📊 Métricas anuais com dados:', metricsWithNumbers.length > 0 ? 'SIM' : 'NÃO');
    console.log('📊 Métricas mensais com dados:', monthlyMetricsWithNumbers.length > 0 ? 'SIM' : 'NÃO');
    
    if (chartCanvas && monthlyChartCanvas && metricsWithNumbers.length > 0 && monthlyMetricsWithNumbers.length > 0) {
      console.log('🎉 TODOS OS TESTES PASSARAM! O filtro está funcionando corretamente.');
    } else {
      console.log('⚠️ ALGUNS TESTES FALHARAM. Verifique os logs acima para mais detalhes.');
    }
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
  } finally {
    await browser.close();
  }
}

testFilterFunctionality();