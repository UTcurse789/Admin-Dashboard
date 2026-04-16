const STRAPI_URL = "https://cms.energdive.com";
const STRAPI_ADMIN_TOKEN = "1e12eeaa778f2b962868da1ea26294e9ddfef5699a02cb9f4ec7c61f6527cd430ac31c1a43c836b0b65c2783acd6d5a8dd8723ccdd3f7d951d18d11a09255bea13ed098ab26f74b6c45bef6433e5a56ce6b8207159db2da8e63e6fbbb1e0b5f08a50fa123c0d5a641552ad1f8caeb84355a39cee8e0889dc1764adf944904a2f";

fetch(`${STRAPI_URL}/api/contents?populate=*&sort=publishedAt:desc&pagination[limit]=1`, {
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${STRAPI_ADMIN_TOKEN}`,
  }
}).then(res => res.json()).then(data => console.log(JSON.stringify(data.data[0], null, 2))).catch(err => console.error(err));
