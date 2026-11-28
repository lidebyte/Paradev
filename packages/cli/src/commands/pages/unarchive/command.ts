import { positional } from "@superset/cli-framework";
import { command } from "../../../lib/command";
import { resolvePageId } from "../pageId";

export default command({
	description: "Put an archived page back in lists",
	args: [positional("page").required().desc("Page id or slug")],
	run: async ({ ctx, args }) => {
		const id = await resolvePageId(ctx, args.page as string);
		await ctx.api.page.setArchived.mutate({ id, archived: false });
		return { data: { id, archived: false }, message: `Unarchived page ${id}` };
	},
});
