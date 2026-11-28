import { Trans, useLingui } from "@lingui/react/macro";
import { Button } from "@superset/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@superset/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@superset/ui/popover";
import { cn } from "@superset/ui/utils";
import { Check, ChevronDown, FolderGit2 } from "lucide-react";
import { useState } from "react";

export interface PageProjectOption {
	projectId: string;
	name: string;
}

interface ProjectFilterProps {
	value: string | null;
	options: PageProjectOption[];
	onChange: (value: string | null) => void;
}

export function ProjectFilter({
	value,
	options,
	onChange,
}: ProjectFilterProps) {
	const { t } = useLingui();
	const [open, setOpen] = useState(false);

	const selected = options.find((option) => option.projectId === value) ?? null;
	const label = selected
		? selected.name
		: value
			? t({ message: "Unknown project" })
			: t({ message: "All projects" });

	const select = (next: string | null) => {
		onChange(next);
		setOpen(false);
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					title={label}
					aria-label={t({ message: `Filter by project: ${label}` })}
					className={cn(
						"h-8 max-w-44 gap-1.5 px-2.5 font-normal",
						value ? "text-foreground" : "text-muted-foreground",
					)}
				>
					<FolderGit2 className="size-4 shrink-0" />
					<span className="truncate text-sm">{label}</span>
					<ChevronDown className="size-3 shrink-0" />
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-64 p-0">
				<Command>
					<CommandInput placeholder={t({ message: "Search projects…" })} />
					<CommandList className="max-h-72">
						<CommandEmpty>
							<Trans>No projects found.</Trans>
						</CommandEmpty>
						<CommandGroup>
							<CommandItem
								aria-checked={value === null}
								onSelect={() => select(null)}
							>
								<FolderGit2 className="size-4 shrink-0" />
								<span className="text-sm">
									<Trans>All projects</Trans>
								</span>
								{value === null && (
									<Check className="ml-auto size-3.5 shrink-0" />
								)}
							</CommandItem>
							{options.map((option) => (
								<CommandItem
									key={option.projectId}
									value={`${option.name} ${option.projectId}`}
									aria-checked={value === option.projectId}
									onSelect={() => select(option.projectId)}
								>
									<FolderGit2 className="size-4 shrink-0" />
									<span className="truncate text-sm">{option.name}</span>
									{value === option.projectId && (
										<Check className="ml-auto size-3.5 shrink-0" />
									)}
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
