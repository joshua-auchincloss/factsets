import { dispatch } from "./commands/index.js";
import { config } from "./config.js";

export const main = async () => {
	await dispatch(config);
};

if (import.meta.main) {
	await main();
}
