// ── Cloudflare Worker: DNS Gold Mobileconfig Generator ──
// Deploy: dnsgold.caovannamutt.workers.dev
// Nhận: GET ?data=<base64-JSON>  JSON = { name, exp }
// Trả:  file .mobileconfig để Safari iOS cài đặt profile DNS

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function escapeXml(v = '') {
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function makeSlug(v = 'Khach') {
  const s = String(v)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return s || 'Khach';
}

function buildXml(rawName) {
  const display = escapeXml(rawName);
  const slug    = makeSlug(rawName);

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>PayloadContent</key>
    <array>
        <dict>
            <key>DNSSettings</key>
            <dict>
                <key>DNSProtocol</key>
                <string>HTTPS</string>
                <key>ServerAddresses</key>
                <array>
                    <string>1.1.1.1</string>
                    <string>1.0.0.1</string>
                    <string>45.90.28.0</string>
                    <string>45.90.30.0</string>
                    <string>2a07:a8c0::</string>
                    <string>2a07:a8c1::</string>
                </array>
                <key>ServerURL</key>
                <string>https://dns.adguard.com/dns-query</string>
                <key>SupplementalMatchDomains</key>
                <array>
                    <string>certs.apple.com</string>
                    <string>crl.apple.com</string>
                    <string>ocsp.apple.com</string>
                    <string>ocsp2.apple.com</string>
                    <string>valid.apple.com</string>
                    <string>crl3.digicert.com</string>
                    <string>crl4.digicert.com</string>
                    <string>ocsp.digicert.cn</string>
                    <string>ocsp.digicert.com</string>
                    <string>api.revenuecat.com</string>
                    <string>app.revenuecat.com</string>
                    <string>in.appcenter.ms</string>
                    <string>app-measurement.com</string>
                    <string>firebaselogging-pa.googleapis.com</string>
                    <string>mixpanel.com</string>
                    <string>api.mixpanel.com</string>
                </array>
            </dict>
            <key>OnDemandRules</key>
            <array>
                <dict>
                    <key>Action</key>
                    <string>Connect</string>
                    <key>InterfaceTypeMatch</key>
                    <string>WiFi</string>
                </dict>
                <dict>
                    <key>Action</key>
                    <string>Connect</string>
                    <key>InterfaceTypeMatch</key>
                    <string>Cellular</string>
                </dict>
            </array>
            <key>PayloadDescription</key>
            <string>Configures device to use Locket VIP Freeze DNS</string>
            <key>PayloadDisplayName</key>
            <string>Locket VIP - ${display}</string>
            <key>PayloadIdentifier</key>
            <string>com.apple.dnsSettings.managed.locketvip.${slug}</string>
            <key>PayloadType</key>
            <string>com.apple.dnsSettings.managed</string>
            <key>PayloadUUID</key>
            <string>C3D4E5F6-7890-1234-5678-90ABCDEF1234</string>
            <key>PayloadVersion</key>
            <integer>1</integer>
        </dict>
    </array>
    <key>PayloadDescription</key>
    <string>Chức Năng:
✔️ Hỗ Trợ Không Bị Mất Locket Gold
_Dương Bình Đẹp Zai_ </string>
    <key>PayloadDisplayName</key>
    <string>💛 Locket Gold VIP (Vĩnh Viễn) - ${display}</string>
    <key>PayloadIdentifier</key>
    <string>com.p12.locket.vip</string>
    <key>PayloadOrganization</key>
    <string>By Duong Binh Vip</string>
    <key>PayloadRemovalDisallowed</key>
    <false/>
    <key>PayloadType</key>
    <string>Configuration</string>
    <key>PayloadUUID</key>
    <string>21098765-4321-DCBA-0F12-4567890ABCDE</string>
    <key>PayloadVersion</key>
    <integer>1</integer>
</dict>
</plist>`;
}

export default {
  async fetch(request) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url    = new URL(request.url);
    const data   = url.searchParams.get('data');

    if (!data) {
      return new Response('Thiếu tham số data', { status: 400, headers: CORS_HEADERS });
    }

    // Decode base64 → JSON
    let decoded;
    try {
      const json = atob(data);
      decoded = JSON.parse(json);
    } catch {
      return new Response('Dữ liệu không hợp lệ', { status: 400, headers: CORS_HEADERS });
    }

    // Kiểm tra hết hạn
    if (Date.now() > decoded.exp) {
      return new Response('Link đã hết hạn', { status: 410, headers: CORS_HEADERS });
    }

    const rawName  = String(decoded.name || 'Khách').trim() || 'Khách';
    const slug     = makeSlug(rawName);
    const filename = `${slug}_DNS_Locket_Gold.mobileconfig`;
    const xml      = buildXml(rawName);

    // Encode filename cho Content-Disposition (RFC 5987)
    const encodedFilename = encodeURIComponent(filename);

    return new Response(xml, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type'        : 'application/x-apple-aspen-config; charset=utf-8',
        'Content-Disposition' : `attachment; filename="${slug}.mobileconfig"; filename*=UTF-8''${encodedFilename}`,
        'Cache-Control'       : 'no-store, no-cache, must-revalidate',
        'Pragma'              : 'no-cache',
      },
    });
  },
};
