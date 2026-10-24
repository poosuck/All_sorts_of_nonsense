export const FLAVORS = [
  { id: "custard", name: "커스터드", english: "CLASSIC CUSTARD", note: "커스터드 & 캐러멜", body: "#ffdfa5", top: "#ffd492", sauce: "#954016", roughness: .29, clearcoat: .5, sauceRoughness: .16 },
  { id: "strawberry", name: "딸기", english: "STRAWBERRY", note: "딸기 & 딸기 소스", body: "#ffc4d0", top: "#f79caf", sauce: "#ad2948", roughness: .25, clearcoat: .65, sauceRoughness: .14 },
  { id: "matcha", name: "말차", english: "MATCHA", note: "말차 & 진한 말차 소스", body: "#bfcd8b", top: "#9aaf68", sauce: "#45632e", roughness: .43, clearcoat: .25, sauceRoughness: .28 },
  { id: "chocolate", name: "초코", english: "CHOCOLATE", note: "밀크초콜릿 & 다크초콜릿", body: "#bd8a69", top: "#a76c4e", sauce: "#492419", roughness: .24, clearcoat: .8, sauceRoughness: .13 },
  { id: "milk", name: "우유", english: "MILK", note: "우유 & 황금빛 캐러멜", body: "#fff6e5", top: "#f5e8d0", sauce: "#b87524", roughness: .35, clearcoat: .35, sauceRoughness: .18 },
] as const;
export type FlavorId = typeof FLAVORS[number]["id"];
export const FLAVOR_STORAGE_KEY = "pudding-flavor";
export function isFlavorId(value: unknown): value is FlavorId {
  return FLAVORS.some(flavor => flavor.id === value);
}
export function getFlavor(id: FlavorId) { return FLAVORS.find(flavor => flavor.id === id) || FLAVORS[0]; }
