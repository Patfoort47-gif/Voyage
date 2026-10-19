import { flagCode } from './country-flags.js';
// ISO 4217 : une devise nationale principale, sans remplacer un choix utilisateur.
const groups = {
 EUR:'AD AT AX BE BG BL CY DE EE ES FI FR GF GP GR HR IE IT LT LU LV MC ME MF MQ MT NL PM PT RE SI SK SM TF VA XK YT',
 USD:'US AS BQ EC FM GU IO MH MP PA PR PW SV TC TL UM VG VI', GBP:'GB GG IM JE',
 SEK:'SE', NOK:'NO SJ BV', DKK:'DK FO GL', CHF:'CH LI', JPY:'JP', CAD:'CA', AUD:'AU CC CX HM KI NF NR TV', NZD:'NZ CK NU PN TK',
 CNY:'CN', HKD:'HK', SGD:'SG', KRW:'KR', INR:'IN', THB:'TH', IDR:'ID', MYR:'MY', PHP:'PH', TRY:'TR', PLN:'PL', CZK:'CZ', HUF:'HU', RON:'RO', ISK:'IS', BRL:'BR', MXN:'MX', ZAR:'ZA', MAD:'MA EH', AED:'AE',
 JOD:'JO', EGP:'EG', TND:'TN', VND:'VN', CLP:'CL', COP:'CO', PEN:'PE', ARS:'AR', ILS:'IL PS', SAR:'SA', QAR:'QA', OMR:'OM', KWD:'KW', BHD:'BH', DZD:'DZ', TWD:'TW', KES:'KE', TZS:'TZ', MUR:'MU', SCR:'SC', GEL:'GE', RSD:'RS', ALL:'AL', BAM:'BA', MKD:'MK', UAH:'UA', HNL:'HN', GTQ:'GT', CRC:'CR', DOP:'DO', BOB:'BO', UYU:'UY', NPR:'NP', LKR:'LK', KHR:'KH', LAK:'LA', MVR:'MV', FJD:'FJ', XPF:'PF NC WF', XOF:'BJ BF CI GW ML NE SN TG', XAF:'CM CF CG GA GQ TD'
};
export const countryCurrencies = Object.fromEntries(Object.entries(groups).flatMap(([currency,codes])=>codes.split(' ').map(code=>[code,currency])));
export function destinationCurrency(trip) { return countryCurrencies[flagCode(trip.country)] || null; }
export const extraCurrencies = Object.keys(groups);
