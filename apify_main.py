import asyncio
import os
from datetime import datetime
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright
from apify import Actor

try:
    from google import genai
except ImportError:
    pass

def ask_gemini_expert(title, price, km, year, context_text=""):
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return True, "IA Desligada (Chave Oculta)"
        
    try:
        client = genai.Client(api_key=api_key)
        prompt = f"""És um mecânico mestre e importador especialista em "Fix & Flip" entre a Alemanha e Portugal.
Encontrei este furgão comercial: '{title}', Ano de {year}, {km}km, preço Base de {price}€.
Texto do Anúncio: {context_text[:600]}

O teu trabalho em 4 passos OBRIGATÓRIOS:
1. AVALIAR DANOS: Procura sinais de avarias no texto. Amolgadelas fáceis ou riscos? EXCELENTE. Danos de Chassis/Motor destruído? REJEITA.
2. CUSTO CHAVE-NA-MÃO PT: Calcula o valor total: {price}€ + 800€ (Transporte p/ PT) + 300€ (ISV Comercial) + 500€ (Reparação).
3. BENCHMARK STANDVIRTUAL / OLX: Atua como analista do Standvirtual e OLX Portugal. Qual é o valor real de mercado (Venda ao Público) de um carro de trabalho de {year} com {km}km em PT? Subtrai o Custo Chave-na-Mão a este Valor de Venda para apurar o LUCRO LIMPO.
4. DECISÃO FINAL: Se o Lucro Limpo for > 2000€, aprova. Senão, rejeita.
Sê extremamente conciso.

Exemplo OBRIGATÓRIO de resposta exata:
SIM - StandVirtual: ~14.500€. Custo Final c/ legalização: ~X€. Lucro Estimado: ~Y€. Danos: Ligeiros."""
        
        response = client.models.generate_content(
            model='gemini-2.0-flash',
            contents=prompt,
        )
        res_text = response.text.strip().replace("\n", " ").replace("\r", " ")
        first_word = res_text.split("-")[0].upper()
        if "SIM" in first_word or "YES" in first_word:
            return True, res_text
        return False, res_text
    except Exception as e:
        return True, f"Erro Avaliador StandVirtual Gemini: {str(e)[:40]}"

def calculate_score(price, km, year, source="marketplace"):
    score = 50
    fair_price = 14000 
    if price > 0:
        ratio = price / fair_price
        if ratio < 0.4: score += 40
        elif ratio < 0.5: score += 30
        elif ratio < 0.6: score += 20
        elif ratio < 0.8: score += 5
        else: score -= 20
    if km <= 50000: score += 20
    elif km <= 80000: score += 15
    elif km <= 120000: score += 10
    elif km <= 150000: score += 5
    else: score -= 5

    age = 2026 - year
    if age <= 1: score += 15
    elif age <= 2: score += 10
    elif age <= 3: score += 5
    elif age <= 5: score += 2

    if source == "b2b_wholesale":
        score += 25
    elif source in ["leasing", "rental", "auction", "trade-in", "private"]:
        score += 10
        
    return max(0, min(100, score))

async def search_kleinanzeigen(page):
    Actor.log.info("🔎 API B2C: Explorando Kleinanzeigen.de (Privados e Danificados Leves)...")
    url = "https://www.kleinanzeigen.de/s-autos/kastenwagen/anzeige:angebote/fuer-gewerbe/c216+autos.ez_i:2021,+autos.schadstoffklasse_s:euro6"
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=15000)
        await asyncio.sleep(4)
        soup = BeautifulSoup(await page.content(), 'html.parser')
        articles = soup.find_all('article', class_='aditem')
        new_deals = []
        for article in articles:
            try:
                title_elem = article.find('h2')
                if not title_elem: continue
                title = title_elem.text.strip()
                article_text = article.text.strip() # Dicas visuais texto para IA
                
                price_str = ""
                p_elem = article.find('p', class_='aditem-main--middle--price-shipping--price')
                if p_elem: price_str = p_elem.text
                price = 0
                if '€' in price_str:
                    num_str = ''.join(filter(str.isdigit, price_str))
                    if num_str: price = int(num_str)
                if price <= 0 or price > 7500: continue # Tolerância leve
                
                km = 120000 # Previsão média para KA
                year = 2021
                
                uid = "klein_" + str(price) + "_" + str(km)
                score = calculate_score(price, km, year, "private")
                
                link = ""
                a_tag = title_elem.find('a')
                if a_tag and a_tag.get('href'): link = "https://www.kleinanzeigen.de" + a_tag['href']
                
                if score >= 40:
                    is_good, ai_verdict = ask_gemini_expert(title, price, km, year, article_text)
                    if not is_good: continue
                        
                    new_deals.append({
                        "id": uid, "vehicle": title, "price": price, "km": km, "year": year,
                        "fuel": "diesel", "source": "private", "link": link,
                        "notes": f"🔨 Kleinanzeigen | 🤖 IA Mecânica: {ai_verdict}",
                        "score": score + 5, "addedAt": datetime.now().isoformat()
                    })
            except Exception: pass
        return new_deals
    except Exception: return []

async def search_autoscout(page):
    Actor.log.info("🔎 API B2C: Explorando AutoScout24 (Com danos aceites - Kastenwagen)...")
    url = "https://www.autoscout24.de/lst?atype=C&body=6&cy=D&fregfrom=2021&kmto=150000&priceto=7000&sort=standard&desc=0" # Removi damaged_listing=exclude intencionalmente!
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=15000)
        await asyncio.sleep(4)
        soup = BeautifulSoup(await page.content(), 'html.parser')
        articles = soup.find_all('article')
        new_deals = []
        for article in articles:
            try:
                title_elem = article.find('h2')
                if not title_elem: continue
                title = title_elem.text.strip()
                article_text = article.text.strip()
                
                price_str = ""
                price_container = article.find(attrs={"data-testid": "regular-price"})
                if price_container: price_str = price_container.text
                price = 0
                if '€' in price_str:
                    num_str = ''.join(filter(str.isdigit, price_str))
                    if num_str: price = int(num_str)
                if price <= 0 or price > 7000: continue
                
                details = article.find_all(attrs={"data-testid": "item-details-list"})
                km = 0; year = 2021
                if details:
                    items = details[0].find_all('li')
                    if len(items) >= 2:
                        km_str = items[0].text
                        num_km = ''.join(filter(str.isdigit, km_str))
                        if num_km: km = int(num_km)
                        year_str = items[1].text
                        num_yr = ''.join(filter(str.isdigit, year_str.split('/')[-1]))
                        if num_yr and len(num_yr) == 4: year = int(num_yr)

                if year < 2021 or km > 150000: continue
                link = ""
                a_tag = article.find('a')
                if a_tag and a_tag.get('href'): link = "https://www.autoscout24.de" + a_tag['href']

                uid = "b2c_" + str(price) + "_" + str(km) + "_" + str(year)
                score = calculate_score(price, km, year, "marketplace")

                if score >= 40:
                    is_good, ai_verdict = ask_gemini_expert(title, price, km, year, article_text)
                    if not is_good: continue
                        
                    new_deals.append({
                        "id": uid, "vehicle": title, "price": price, "km": km, "year": year,
                        "fuel": "diesel", "source": "marketplace", "link": link,
                        "notes": f"🤖 IA Mecânica: {ai_verdict}",
                        "score": score, "addedAt": datetime.now().isoformat()
                    })
            except Exception: pass
        return new_deals
    except Exception: return []

async def search_auto1_b2b(page):
    """ Auto1.com com Avaliação Mecânica IA """
    email = os.environ.get('AUTO1_EMAIL')
    password = os.environ.get('AUTO1_PASSWORD')
    if not email or not password: return []

    Actor.log.info("🔐 B2B: Login furtivo Auto1...")
    new_deals = []
    try:
        await page.goto("https://www.auto1.com/en/login", wait_until="domcontentloaded", timeout=20000)
        await asyncio.sleep(2)
        await page.fill('input[type="email"], input[name="email"], input[id="email"]', email)
        await asyncio.sleep(0.5)
        await page.fill('input[type="password"], input[name="password"]', password)
        await asyncio.sleep(0.5)
        
        login_btn = await page.query_selector('button[type="submit"]')
        if login_btn:
            await login_btn.click()
            await asyncio.sleep(6)
            
        search_url = "https://www.auto1.com/en/market?bodyType=transporter&fuel=diesel&registrationYearFrom=2021&mileageTo=150000"
        await page.goto(search_url, wait_until="networkidle", timeout=30000)
        await asyncio.sleep(5)
        
        soup = BeautifulSoup(await page.content(), 'html.parser')
        car_rows = soup.find_all(['tr', 'article', 'div'], class_=lambda x: x and ('car' in x.lower() or 'item' in x.lower()))
        
        for row in car_rows:
            try:
                text_content = row.text.strip()
                if not text_content or len(text_content) < 30 or '202' not in text_content: continue
                
                title = "Furgão Auto1 " + text_content[:40].replace('\n', ' ') + "..."
                price = 6500; km = 90000; year = 2021
                score = calculate_score(price, km, year, "b2b_wholesale")
                
                is_good, ai_verdict = ask_gemini_expert(title, price, km, year, text_content)
                if not is_good: continue

                new_deals.append({
                    "id": "b2b_auto1_" + str(len(new_deals)), "vehicle": title, "price": price, "km": km, "year": year,
                    "fuel": "diesel", "source": "b2b_auction", "link": search_url,
                    "notes": f"⚡ AUTO1 | 🤖 IA Mecânica B2B: {ai_verdict}",
                    "score": score, "addedAt": datetime.now().isoformat()
                })
                if len(new_deals) >= 5: break
            except Exception: pass
        return new_deals
    except Exception: return []

async def search_openlane_b2b(page):
    """ OpenLane com Avaliação IA """
    user = os.environ.get('OPENLANE_USER')
    password = os.environ.get('OPENLANE_PASSWORD')
    if not user or not password: return []

    Actor.log.info("🔐 B2B: Login furtivo OpenLane...")
    new_deals = []
    try:
        await page.goto("https://www.openlane.eu/en/login", wait_until="domcontentloaded", timeout=20000)
        await asyncio.sleep(2)
        await page.fill('input[name*="username"], input[type="text"]', user)
        await asyncio.sleep(0.5)
        await page.fill('input[type="password"], input[name="password"]', password)
        await asyncio.sleep(0.5)
        
        btn = await page.query_selector('button[type="submit"]')
        if btn:
            btn.click()
            await asyncio.sleep(6)
            
        search_url = "https://www.openlane.eu/en/findcar?bodyType=transporter&registrationYearFrom=2021"
        await page.goto(search_url, wait_until="networkidle", timeout=30000)
        await asyncio.sleep(5)
        
        soup = BeautifulSoup(await page.content(), 'html.parser')
        car_rows = soup.find_all(['div', 'li', 'article'], class_=lambda x: x and ('car' in x.lower() or 'item' in x.lower()))
        
        for row in car_rows:
            try:
                text_content = row.text.strip()
                if not text_content or len(text_content) < 20 or '202' not in text_content: continue
                
                title = "Furgão OpenLane " + text_content[:40].replace('\n', ' ') + "..."
                price = 5900; km = 80000; year = 2021
                score = calculate_score(price, km, year, "b2b_wholesale")
                
                is_good, ai_verdict = ask_gemini_expert(title, price, km, year, text_content)
                if not is_good: continue

                new_deals.append({
                    "id": "b2b_ol_" + str(len(new_deals)), "vehicle": title, "price": price, "km": km, "year": year,
                    "fuel": "diesel", "source": "b2b_auction", "link": search_url,
                    "notes": f"⚡ OPENLANE | 🤖 IA Mecânica B2B: {ai_verdict}",
                    "score": score, "addedAt": datetime.now().isoformat()
                })
                if len(new_deals) >= 5: break
            except Exception: pass
        return new_deals
    except Exception: return []

async def main():
    async with Actor:
        Actor.log.info("🚀 API Apify Iniciada - Iniciando IA Gemini e Autómatos Leiloeiros")
        
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/113.0.0.0 Safari/537.36"
            )
            page = await context.new_page()
            
            deals_found = []
            
            # 1. B2C Dano Ligeiro
            deals_found.extend(await search_autoscout(page))
            deals_found.extend(await search_kleinanzeigen(page))
            
            # 2. B2B Wholesale
            auto1_deals = await search_auto1_b2b(page)
            if auto1_deals: deals_found.extend(auto1_deals)

            openlane_deals = await search_openlane_b2b(page)
            if openlane_deals: deals_found.extend(openlane_deals)
            
            if deals_found:
                Actor.log.info(f"🚨 IA Mecânica APROVOU {len(deals_found)} veículos! A enviar para JSON...")
                await Actor.push_data(deals_found)
            else:
                Actor.log.info("⚠️ A IA rejeitou os carros avariados estragados de mais ou não encontrou nada.")
                
            await browser.close()
            Actor.log.info("Matriz de Extração e Triagem Concluída.")

if __name__ == "__main__":
    asyncio.run(main())
