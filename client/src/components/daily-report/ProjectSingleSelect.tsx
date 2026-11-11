import { useState } from 'react';
import { Check, ChevronsUpDown, FolderKanban } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  ALL_PROJECTS,
  PROJECTS,
  PROJECT_CATEGORIES,
} from '@shared/projects';

interface ProjectSingleSelectProps {
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
}

export const ProjectSingleSelect: React.FC<ProjectSingleSelectProps> = ({
  value,
  onChange,
  placeholder = '请选择项目',
}) => {
  const [open, setOpen] = useState(false);
  const selected = ALL_PROJECTS.find((item) => item.code === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="选择项目"
          className="h-10 w-full justify-between gap-2 overflow-hidden px-3 text-left font-normal"
        >
          <span className="flex min-w-0 flex-1 items-center gap-2">
            {selected ? (
              <Badge
                variant="outline"
                className="mr-0 min-w-0 border-primary/20 bg-primary/5 text-xs font-normal text-slate-700"
              >
                <span className="truncate">{selected.name}</span>
              </Badge>
            ) : (
              <span className="flex items-center gap-2 text-slate-500">
                <FolderKanban className="size-4 shrink-0" />
                <span className="truncate">{placeholder}</span>
              </span>
            )}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-slate-400" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <Command>
          <CommandInput placeholder="搜索项目..." />
          <CommandList>
            <CommandEmpty>无匹配项目</CommandEmpty>
            {PROJECT_CATEGORIES.map((category) => (
              <CommandGroup key={category} heading={category}>
                {PROJECTS[category].map((item) => (
                  <CommandItem
                    key={item.code}
                    value={`${item.code} ${item.name}`}
                    onSelect={() => {
                      onChange(item.code);
                      setOpen(false);
                    }}
                    className="gap-2.5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-slate-800">
                        {item.name}
                      </span>
                      <span className="block truncate text-xs text-slate-400">
                        {item.code}
                      </span>
                    </span>
                    {item.code === value && (
                      <Check className="size-4 shrink-0 text-primary" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
