const STRAPI_URL = "https://cms.energdive.com";
const STRAPI_ADMIN_TOKEN = "1e12eeaa778f2b962868da1ea26294e9ddfef5699a02cb9f4ec7c61f6527cd430ac31c1a43c836b0b65c2783acd6d5a8dd8723ccdd3f7d951d18d11a09255bea13ed098ab26f74b6c45bef6433e5a56ce6b8207159db2da8e63e6fbbb1e0b5f08a50fa123c0d5a641552ad1f8caeb84355a39cee8e0889dc1764adf944904a2f";

async function run() {
  const res = await fetch(`${STRAPI_URL}/api/contents?populate=*&pagination[limit]=100&sort=publishedAt:desc`, {
    headers: {
      Authorization: `Bearer ${STRAPI_ADMIN_TOKEN}`,
    }
  });
  const data = await res.json();
  const list = data.data.slice(0, 5);
  list.forEach((a: any) => console.log(a.Title, "=> Author:", a.author?.name || a.author?.data?.attributes?.name || "NULL"));
}
run();
