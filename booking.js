// ─── Constants ───────────────────────────────────────────────────────────────
const RATE_PER_MILE = 2;
const BOOKING_FEE   = 25;

// ─── State ───────────────────────────────────────────────────────────────────
let estimatedMiles = 0;
let priceCalculated = false;

// ─── Geocoding via Nominatim (OpenStreetMap, free, no key required) ───────────
async function geocode(address) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=gb&limit=1`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  const data = await res.json();
  if (!data.length) throw new Error(`Could not find location: "${address}"`);
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), name: data[0].display_name };
}

// ─── Haversine distance in miles ──────────────────────────────────────────────
function haversine(lat1, lon1, lat2, lon2) {
  const R = 3958.8; // Earth radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

function toRad(deg) { return deg * Math.PI / 180; }

// Road distance is typically ~1.3× the straight-line distance
function estimateRoadMiles(straightMiles) {
  return Math.round(straightMiles * 1.3);
}

// ─── Price Calculation ────────────────────────────────────────────────────────
function calcPrice(miles, includeReturn = false) {
  const mileageCost = miles * RATE_PER_MILE;
  const returnCost  = includeReturn ? mileageCost : 0;
  const total       = mileageCost + returnCost + BOOKING_FEE;
  return { mileageCost, returnCost, total };
}

function updatePriceSummary(miles) {
  const includeReturn = document.getElementById('return-journey').checked;
  const { mileageCost, returnCost, total } = calcPrice(miles, includeReturn);

  document.getElementById('price-breakdown').style.display = 'block';
  document.getElementById('summary-distance').textContent   = `${miles} miles`;
  document.getElementById('summary-mileage').textContent    = `£${mileageCost.toFixed(2)}`;
  document.getElementById('summary-total').textContent      = `£${total.toFixed(2)}`;
  document.getElementById('pay-total').textContent          = `£${total.toFixed(2)}`;
  document.getElementById('distance-value').textContent     = `~${miles} miles`;
  document.getElementById('distance-result').style.display  = 'block';

  const returnRow = document.getElementById('return-row');
  if (includeReturn) {
    returnRow.classList.remove('hidden');
    document.getElementById('summary-return').textContent = `£${returnCost.toFixed(2)}`;
  } else {
    returnRow.classList.add('hidden');
  }

  return total;
}

function updatePrice() {
  if (estimatedMiles > 0) updatePriceSummary(estimatedMiles);
}

// ─── Journey summary in sidebar ───────────────────────────────────────────────
function updateJourneySummary(pickup, dest, date, time) {
  const dateStr = date ? new Date(date + 'T00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }) : '—';
  document.getElementById('summary-journey').innerHTML = `
    <div class="journey-row">
      <span class="journey-dot green-dot">&#11044;</span>
      <div>
        <div class="journey-label">Pickup</div>
        <div class="journey-val">${escHtml(pickup)}</div>
      </div>
    </div>
    <div class="journey-line"></div>
    <div class="journey-row">
      <span class="journey-dot red-dot">&#11044;</span>
      <div>
        <div class="journey-label">Destination</div>
        <div class="journey-val">${escHtml(dest)}</div>
      </div>
    </div>
    <div class="journey-meta">
      <span>&#128197; ${escHtml(dateStr)}</span>
      <span>&#128336; ${escHtml(time || '—')}</span>
    </div>
  `;
}

function escHtml(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str));
  return d.innerHTML;
}

// ─── Validation helpers ───────────────────────────────────────────────────────
function setError(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; }
}

function clearErrors(ids) {
  ids.forEach(id => setError(id, ''));
}

function validateStep1() {
  const date   = document.getElementById('pickup-date').value;
  const time   = document.getElementById('pickup-time').value;
  const pass   = document.getElementById('passengers').value;
  const pickup = document.getElementById('pickup-location').value.trim();
  const dest   = document.getElementById('destination').value.trim();

  clearErrors(['error-pickup-date','error-pickup-time','error-passengers','error-pickup-location','error-destination']);
  let valid = true;

  if (!date) { setError('error-pickup-date', 'Please select a pickup date.'); valid = false; }
  else if (new Date(date) < new Date(new Date().toDateString())) { setError('error-pickup-date', 'Date cannot be in the past.'); valid = false; }
  if (!time)   { setError('error-pickup-time', 'Please select a pickup time.'); valid = false; }
  if (!pass)   { setError('error-passengers', 'Please select the number of passengers.'); valid = false; }
  if (!pickup) { setError('error-pickup-location', 'Please enter a pickup location.'); valid = false; }
  if (!dest)   { setError('error-destination', 'Please enter a destination.'); valid = false; }

  return valid;
}

function validateStep2() {
  const first = document.getElementById('first-name').value.trim();
  const last  = document.getElementById('last-name').value.trim();
  const email = document.getElementById('email').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const terms = document.getElementById('terms').checked;

  clearErrors(['error-first-name','error-last-name','error-email','error-phone','error-terms']);
  let valid = true;

  if (!first)  { setError('error-first-name', 'Please enter your first name.'); valid = false; }
  if (!last)   { setError('error-last-name', 'Please enter your last name.'); valid = false; }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('error-email', 'Please enter a valid email address.'); valid = false; }
  if (!phone || phone.replace(/\D/g, '').length < 10) { setError('error-phone', 'Please enter a valid phone number.'); valid = false; }
  if (!terms)  { setError('error-terms', 'You must agree to the terms and conditions.'); valid = false; }

  return valid;
}

function validateStep3() {
  const name    = document.getElementById('card-name').value.trim();
  const number  = document.getElementById('card-number').value.replace(/\s/g, '');
  const expiry  = document.getElementById('card-expiry').value.trim();
  const cvv     = document.getElementById('card-cvv').value.trim();
  const post    = document.getElementById('billing-postcode').value.trim();

  clearErrors(['error-card-name','error-card-number','error-card-expiry','error-card-cvv','error-billing-postcode']);
  let valid = true;

  if (!name)   { setError('error-card-name', 'Please enter the name on your card.'); valid = false; }
  if (!/^\d{13,19}$/.test(number)) { setError('error-card-number', 'Please enter a valid card number.'); valid = false; }
  if (!/^\d{2}\s*\/\s*\d{2}$/.test(expiry)) { setError('error-card-expiry', 'Please enter a valid expiry date (MM / YY).'); valid = false; }
  if (!/^\d{3,4}$/.test(cvv))  { setError('error-card-cvv', 'Please enter a valid CVV.'); valid = false; }
  if (!post)   { setError('error-billing-postcode', 'Please enter your billing postcode.'); valid = false; }

  return valid;
}

// ─── Step navigation ──────────────────────────────────────────────────────────
function goToStep(n) {
  document.querySelectorAll('.form-step').forEach((el, i) => {
    el.classList.toggle('hidden', i + 1 !== n);
  });
  document.querySelectorAll('.step').forEach((el, i) => {
    el.classList.toggle('active', i < n);
    el.classList.toggle('completed', i < n - 1);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── Card number formatting ───────────────────────────────────────────────────
document.getElementById('card-number').addEventListener('input', function () {
  let v = this.value.replace(/\D/g, '').substring(0, 16);
  this.value = v.replace(/(.{4})/g, '$1 ').trim();
});

document.getElementById('card-expiry').addEventListener('input', function () {
  let v = this.value.replace(/\D/g, '').substring(0, 4);
  if (v.length > 2) v = v.substring(0, 2) + ' / ' + v.substring(2);
  this.value = v;
});

document.getElementById('card-cvv').addEventListener('input', function () {
  this.value = this.value.replace(/\D/g, '').substring(0, 4);
});

// ─── Step 1 → 2: geocode and calculate ───────────────────────────────────────
document.getElementById('step1-next').addEventListener('click', async () => {
  if (!validateStep1()) return;

  const btn    = document.getElementById('step1-next');
  const pickup = document.getElementById('pickup-location').value.trim();
  const dest   = document.getElementById('destination').value.trim();
  const date   = document.getElementById('pickup-date').value;
  const time   = document.getElementById('pickup-time').value;

  btn.textContent = 'Calculating distance…';
  btn.disabled = true;

  try {
    const [fromCoords, toCoords] = await Promise.all([geocode(pickup), geocode(dest)]);
    const straightMiles = haversine(fromCoords.lat, fromCoords.lon, toCoords.lat, toCoords.lon);
    estimatedMiles = estimateRoadMiles(straightMiles);
    priceCalculated = true;

    updateJourneySummary(pickup, dest, date, time);
    updatePriceSummary(estimatedMiles);
    goToStep(2);
  } catch (err) {
    const msg = err.message.includes('Could not find')
      ? err.message + '. Please check the address and try again.'
      : 'Could not calculate distance. Please check your addresses and try again.';

    if (err.message.includes('pickup') || err.message.toLowerCase().includes(pickup.toLowerCase().substring(0, 5))) {
      setError('error-pickup-location', msg);
    } else {
      setError('error-destination', msg);
    }
  } finally {
    btn.textContent = 'Calculate Price & Continue';
    btn.disabled = false;
  }
});

// ─── Step 2 back/next ─────────────────────────────────────────────────────────
document.getElementById('step2-back').addEventListener('click', () => goToStep(1));
document.getElementById('step2-next').addEventListener('click', () => {
  if (validateStep2()) goToStep(3);
});

// ─── Step 3 back ──────────────────────────────────────────────────────────────
document.getElementById('step3-back').addEventListener('click', () => goToStep(2));

// ─── Return journey toggle ────────────────────────────────────────────────────
document.getElementById('return-journey').addEventListener('change', updatePrice);

// ─── Form submission ──────────────────────────────────────────────────────────
document.getElementById('booking-form').addEventListener('submit', function (e) {
  e.preventDefault();
  if (!validateStep3()) return;

  const payBtn = document.getElementById('pay-btn');
  payBtn.textContent = 'Processing…';
  payBtn.disabled = true;

  // Simulate payment processing delay
  setTimeout(() => {
    const email = document.getElementById('email').value.trim();
    const ref   = 'PC-' + Date.now().toString(36).toUpperCase();
    const first = document.getElementById('first-name').value.trim();
    const last  = document.getElementById('last-name').value.trim();
    const pickup = document.getElementById('pickup-location').value.trim();
    const dest   = document.getElementById('destination').value.trim();
    const date   = document.getElementById('pickup-date').value;
    const time   = document.getElementById('pickup-time').value;
    const dateStr = new Date(date + 'T00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const { total } = calcPrice(estimatedMiles, document.getElementById('return-journey').checked);

    document.getElementById('confirm-email').textContent = email;
    document.getElementById('confirm-ref').textContent   = ref;
    document.getElementById('modal-details').innerHTML = `
      <div class="modal-detail-row"><span>Passenger</span><strong>${escHtml(first + ' ' + last)}</strong></div>
      <div class="modal-detail-row"><span>Pickup</span><strong>${escHtml(pickup)}</strong></div>
      <div class="modal-detail-row"><span>Destination</span><strong>${escHtml(dest)}</strong></div>
      <div class="modal-detail-row"><span>Date &amp; Time</span><strong>${escHtml(dateStr)} at ${escHtml(time)}</strong></div>
      <div class="modal-detail-row"><span>Distance</span><strong>~${estimatedMiles} miles</strong></div>
      <div class="modal-detail-row"><span>Total Paid</span><strong class="gold">£${total.toFixed(2)}</strong></div>
    `;

    document.getElementById('confirmation-modal').classList.remove('hidden');
    payBtn.textContent = 'Confirm & Pay';
    payBtn.disabled = false;
  }, 1800);
});
