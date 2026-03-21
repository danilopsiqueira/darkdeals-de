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

# ==================================================================
# IA GEMINI — Cérebro Financeiro do Importador
# ==================================================================
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
3. BENCHMARK STANDVIRTUAL / OLX: Atua como analista do Standvirtual e OLX Portugal. Qual é o valor real de mercado (Venda ao Público) de um furgão comercial de {year} com {km}km em PT? Subtrai o Custo Chave-na-Mão a este Valor de Venda para apurar o LUCRO LIMPO.
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
    fair_price = 18000
    if price > 0:
        ratio = price / fair_price
        if ratio < 0.3: score += 40
        elif ratio < 0.5: score += 30
        elif ratio < 0.65: score += 20
        elif ratio < 0.8: score += 5
        else: score -= 10
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

# ==================================================================
# FONTE 1 — AutoScout24.de (Transporter / Van / Kastenwagen)
# ==================================================================
async def search_autoscout(page):
    Actor.log.info("🔎 FONTE 1: AutoScout24 — Transporter / Van / Kastenwagen...")
    urls = [
        "https://www.autoscout24.de/lst?atype=C&body=7&cy=D&fregfrom=2020&kmto=150000&priceto=15000&sort=price&desc=0",
        "https://www.autoscout24.de/lst?atype=C&body=12&cy=D&fregfrom=2020&kmto=150000&priceto=15000&sort=price&desc=0",
    ]
    all_deals = []
    for url in urls:
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=20000)
            await asyncio.sleep(5)
            soup = BeautifulSoup(await page.content(), 'html.parser')
            articles = soup.find_all('article')
            for article in articles:
                try:
                    title_elem = article.find('h2')
                    if not title_elem: continue
                    title = title_elem.text.strip()
                    low = title.lower()
                    # Filtro de relevância: só carrinhas comerciais
                    van_keywords = ['transit', 'sprinter', 'transporter', 'vito', 'crafter',
                                    'ducato', 'boxer', 'jumper', 'daily', 'master', 'movano',
                                    'caddy', 'berlingo', 'partner', 'kangoo', 'combo', 'citan',
                                    'proace', 'expert', 'jumpy', 'vivaro', 'trafic', 'van',
                                    'kastenwagen', 'kasten', 'l1h1', 'l2h2', 'l3h2', 'l2h1',
                                    'furgon', 'panel', 'lieferwagen', 'nutzfahrzeug']
                    if not any(kw in low for kw in van_keywords):
                        continue
                    article_text = article.text.strip()
                    price_str = ""
                    price_container = article.find(attrs={"data-testid": "regular-price"})
                    if price_container: price_str = price_container.text
                    price = 0
                    if '€' in price_str:
                        num_str = ''.join(filter(str.isdigit, price_str))
                        if num_str: price = int(num_str)
                    if price <= 0 or price > 15000: continue
                    details = article.find_all(attrs={"data-testid": "item-details-list"})
                    km = 0; year = 2020
                    if details:
                        items = details[0].find_all('li')
                        if len(items) >= 2:
                            num_km = ''.join(filter(str.isdigit, items[0].text))
                            if num_km: km = int(num_km)
                            num_yr = ''.join(filter(str.isdigit, items[1].text.split('/')[-1]))
                            if num_yr and len(num_yr) == 4: year = int(num_yr)
                    if year < 2020 or km > 150000: continue
                    link = ""
                    a_tag = article.find('a')
                    if a_tag and a_tag.get('href'): link = "https://www.autoscout24.de" + a_tag['href']
                    uid = "as24_" + str(price) + "_" + str(km) + "_" + str(year)
                    score = calculate_score(price, km, year, "marketplace")
                    if score >= 35:
                        is_good, ai_verdict = ask_gemini_expert(title, price, km, year, article_text)
                        if not is_good: continue
                        all_deals.append({
                            "id": uid, "vehicle": title, "price": price, "km": km, "year": year,
                            "fuel": "diesel", "source": "marketplace", "link": link,
                            "notes": f"🚛 AutoScout24 | 🤖 IA: {ai_verdict}",
                            "score": score, "addedAt": datetime.now().isoformat()
                        })
                except Exception: pass
        except Exception as e:
            Actor.log.warning(f"AutoScout24 URL falhou: {str(e)[:60]}")
    Actor.log.info(f"AutoScout24: {len(all_deals)} furgões aprovados pela IA")
    return all_deals

# ==================================================================
# FONTE 2 — mobile.de (O maior marketplace da Alemanha)
# ==================================================================
async def search_mobile_de(page):
    Actor.log.info("🔎 FONTE 2: mobile.de — Transporter / Kastenwagen...")
    urls = [
        "https://suchen.mobile.de/fahrzeuge/search.html?dam=0&isSearchRequest=true&ms=&od=down&ref=quickSearch&s=Car&sb=p&vc=Van&fr=2020%3A&ml=%3A150000&p=%3A15000",
        "https://suchen.mobile.de/fahrzeuge/search.html?dam=0&isSearchRequest=true&ms=&od=down&ref=quickSearch&s=Car&sb=p&vc=TransporterVan&fr=2020%3A&ml=%3A150000&p=%3A15000",
    ]
    all_deals = []
    for url in urls:
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=20000)
            await asyncio.sleep(5)
            # Aceitar cookies se necessário
            try:
                consent = await page.query_selector('button[data-testid="gdpr-consent-accept-btn"], .mde-consent-accept-btn, #gdpr-consent-accept-btn')
                if consent: await consent.click()
                await asyncio.sleep(2)
            except: pass
            soup = BeautifulSoup(await page.content(), 'html.parser')
            listings = soup.find_all(['div', 'article', 'a'], class_=lambda x: x and ('result' in str(x).lower() or 'listing' in str(x).lower() or 'cBox' in str(x)))
            for item in listings:
                try:
                    text = item.text.strip()
                    if len(text) < 30: continue
                    title_elem = item.find(['h2', 'h3', 'span'], class_=lambda x: x and ('title' in str(x).lower() or 'headline' in str(x).lower()))
                    title = title_elem.text.strip() if title_elem else text[:60]
                    low = title.lower()
                    van_keywords = ['transit', 'sprinter', 'transporter', 'vito', 'crafter',
                                    'ducato', 'boxer', 'jumper', 'daily', 'master', 'movano',
                                    'caddy', 'berlingo', 'partner', 'kangoo', 'combo', 'citan',
                                    'kastenwagen', 'kasten', 'van', 'furgon', 'lieferwagen']
                    if not any(kw in low for kw in van_keywords):
                        continue
                    price = 0
                    price_elem = item.find(['span', 'div', 'p'], class_=lambda x: x and ('price' in str(x).lower()))
                    if price_elem:
                        num_str = ''.join(filter(str.isdigit, price_elem.text))
                        if num_str: price = int(num_str)
                    if price <= 500 or price > 15000: continue
                    km = 80000; year = 2021
                    # Tentar extrair km e ano do texto
                    import re
                    km_match = re.search(r'(\d{1,3}[\.\s]?\d{3})\s*km', text)
                    if km_match:
                        km_val = int(km_match.group(1).replace('.', '').replace(' ', ''))
                        if 1000 < km_val < 300000: km = km_val
                    year_match = re.search(r'(202[0-6])', text)
                    if year_match: year = int(year_match.group(1))
                    if year < 2020 or km > 150000: continue
                    link = ""
                    a_tag = item.find('a', href=True)
                    if a_tag:
                        href = a_tag['href']
                        if href.startswith('/'): link = "https://suchen.mobile.de" + href
                        elif href.startswith('http'): link = href
                    uid = "mob_" + str(price) + "_" + str(km) + "_" + str(year)
                    score = calculate_score(price, km, year, "marketplace")
                    if score >= 35:
                        is_good, ai_verdict = ask_gemini_expert(title, price, km, year, text)
                        if not is_good: continue
                        all_deals.append({
                            "id": uid, "vehicle": title, "price": price, "km": km, "year": year,
                            "fuel": "diesel", "source": "marketplace", "link": link,
                            "notes": f"🚗 mobile.de | 🤖 IA: {ai_verdict}",
                            "score": score, "addedAt": datetime.now().isoformat()
                        })
                except Exception: pass
        except Exception as e:
            Actor.log.warning(f"mobile.de URL falhou: {str(e)[:60]}")
    Actor.log.info(f"mobile.de: {len(all_deals)} furgões aprovados pela IA")
    return all_deals

# ==================================================================
# FONTE 3 — Kleinanzeigen.de (Privados / Oportunidades)
# ==================================================================
async def search_kleinanzeigen(page):
    Actor.log.info("🔎 FONTE 3: Kleinanzeigen.de — Kastenwagen Privados...")
    urls = [
        "https://www.kleinanzeigen.de/s-autos/kastenwagen/anzeige:angebote/preis::15000/c216+autos.ez_i:2020,",
        "https://www.kleinanzeigen.de/s-transporter/anzeige:angebote/preis::15000/c276+autos.ez_i:2020,",
    ]
    all_deals = []
    for url in urls:
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=15000)
            await asyncio.sleep(4)
            soup = BeautifulSoup(await page.content(), 'html.parser')
            articles = soup.find_all('article', class_='aditem')
            for article in articles:
                try:
                    title_elem = article.find('h2')
                    if not title_elem: continue
                    title = title_elem.text.strip()
                    article_text = article.text.strip()
                    price_str = ""
                    p_elem = article.find('p', class_='aditem-main--middle--price-shipping--price')
                    if p_elem: price_str = p_elem.text
                    price = 0
                    if '€' in price_str:
                        num_str = ''.join(filter(str.isdigit, price_str))
                        if num_str: price = int(num_str)
                    if price <= 0 or price > 15000: continue
                    km = 100000; year = 2021
                    uid = "klein_" + str(price) + "_" + title[:10].replace(' ','')
                    link = ""
                    a_tag = title_elem.find('a')
                    if a_tag and a_tag.get('href'): link = "https://www.kleinanzeigen.de" + a_tag['href']
                    score = calculate_score(price, km, year, "private")
                    if score >= 35:
                        is_good, ai_verdict = ask_gemini_expert(title, price, km, year, article_text)
                        if not is_good: continue
                        all_deals.append({
                            "id": uid, "vehicle": title, "price": price, "km": km, "year": year,
                            "fuel": "diesel", "source": "private", "link": link,
                            "notes": f"🔨 Kleinanzeigen | 🤖 IA: {ai_verdict}",
                            "score": score + 5, "addedAt": datetime.now().isoformat()
                        })
                except Exception: pass
        except Exception as e:
            Actor.log.warning(f"Kleinanzeigen URL falhou: {str(e)[:60]}")
    Actor.log.info(f"Kleinanzeigen: {len(all_deals)} furgões aprovados pela IA")
    return all_deals

# ==================================================================
# FONTE 4 — Auto1 B2B (Wholesale)
# ==================================================================
async def search_auto1_b2b(page):
    email = os.environ.get('AUTO1_EMAIL')
    password = os.environ.get('AUTO1_PASSWORD')
    if not email or not password: return []
    Actor.log.info("🔐 FONTE 4: Auto1 B2B — Login e Transporter Wholesale...")
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
        search_url = "https://www.auto1.com/en/market?bodyType=transporter&fuel=diesel&registrationYearFrom=2020&mileageTo=150000"
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
                    "notes": f"⚡ AUTO1 B2B | 🤖 IA: {ai_verdict}",
                    "score": score, "addedAt": datetime.now().isoformat()
                })
                if len(new_deals) >= 5: break
            except Exception: pass
        return new_deals
    except Exception: return []

# ==================================================================
# FONTE 5 — OpenLane B2B (Ex-ADESA)
# ==================================================================
async def search_openlane_b2b(page):
    user = os.environ.get('OPENLANE_USER')
    password = os.environ.get('OPENLANE_PASSWORD')
    if not user or not password: return []
    Actor.log.info("🔐 FONTE 5: OpenLane B2B — Transporter Leilão...")
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
            await btn.click()
            await asyncio.sleep(6)
        search_url = "https://www.openlane.eu/en/findcar?bodyType=transporter&registrationYearFrom=2020"
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
                    "notes": f"⚡ OPENLANE B2B | 🤖 IA: {ai_verdict}",
                    "score": score, "addedAt": datetime.now().isoformat()
                })
                if len(new_deals) >= 5: break
            except Exception: pass
        return new_deals
    except Exception: return []

# ==================================================================
# MAIN — Orquestrador Multi-Fonte
# ==================================================================
async def main():
    async with Actor:
        Actor.log.info("🚀 DarkDeals DE v3.0 — Motor Multi-Fonte com IA Gemini")
        Actor.log.info("   Fontes: AutoScout24 | mobile.de | Kleinanzeigen | Auto1 | OpenLane")
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
            )
            page = await context.new_page()
            deals_found = []

            # FONTE 1: AutoScout24
            try:
                deals_found.extend(await search_autoscout(page))
            except Exception as e:
                Actor.log.warning(f"AutoScout24 falhou: {str(e)[:60]}")

            # FONTE 2: mobile.de
            try:
                deals_found.extend(await search_mobile_de(page))
            except Exception as e:
                Actor.log.warning(f"mobile.de falhou: {str(e)[:60]}")

            # FONTE 3: Kleinanzeigen
            try:
                deals_found.extend(await search_kleinanzeigen(page))
            except Exception as e:
                Actor.log.warning(f"Kleinanzeigen falhou: {str(e)[:60]}")

            # FONTE 4: Auto1 B2B
            try:
                auto1 = await search_auto1_b2b(page)
                if auto1: deals_found.extend(auto1)
            except Exception as e:
                Actor.log.warning(f"Auto1 falhou: {str(e)[:60]}")

            # FONTE 5: OpenLane B2B
            try:
                ol = await search_openlane_b2b(page)
                if ol: deals_found.extend(ol)
            except Exception as e:
                Actor.log.warning(f"OpenLane falhou: {str(e)[:60]}")

            # Resultado final
            if deals_found:
                Actor.log.info(f"🏆 IA APROVOU {len(deals_found)} furgões comerciais de {5} fontes!")
                await Actor.push_data(deals_found)
            else:
                Actor.log.info("⚠️ Nenhum furgão aprovado neste ciclo. A IA foi muito restritiva ou os sites bloquearam.")
            await browser.close()
            Actor.log.info("✅ DarkDeals DE v3.0 — Ciclo Multi-Fonte Concluído.")

if __name__ == "__main__":
    asyncio.run(main())
