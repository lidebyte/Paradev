import { skillResponse } from "@/lib/skills-source";

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ skill: string }> },
) {
	const { skill } = await params;
	return skillResponse(request, skill);
}
