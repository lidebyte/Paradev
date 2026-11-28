import { positional } from "@superset/cli-framework";
import { command } from "../../../lib/command";
import { resolvePageId } from "../pageId";

export default command({
	description:
		"Archive a page: hide it from lists while its link keeps working",
	args: [positional("page").required().desc("Page id or slug")],
	run: async ({ ctx, args }) => {
		const id = await resolvePageId(ctx, args.page as string);
		await ctx.api.page.setArchived.mutate({ id, archived: true });
		return { data: { id, archived: true }, message: `Archived page ${id}` };
	},
});
