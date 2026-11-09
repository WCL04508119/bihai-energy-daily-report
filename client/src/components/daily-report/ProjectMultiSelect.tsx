import { useState } from 'react';
import { ChevronsUpDown, Check, FolderKanban } from 'lucide-react';

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
import { Checkbox } from '@/components/ui/checkbox';
import {
  ALL_PROJECTS,
  PROJECTS,
  PROJECT_CATEGORIES,
} from '@shared/projects';

interface ProjectMultiSelectProps {
  value: string[];
  onChange: (codes: string[]) => void;
  placeholder?: string;
  showClear?: boolean;
}

export const ProjectMultiSelect: React.FC<ProjectMultiSelectProps> = ({
  value,
  onChange,
  placeholder = '请选择项目（可多选）',
  showClear = true,
}) => {
  const [open, setOpen] = useState(false);

  const selected = ALL_PROJECTS.filter((item) =>
    value.includes(item.code),
  );

  const toggle = (code: string, checked: boolean): void => {
    const next = checked
      ? [...value, code]
      : value.filter((c: string) => c !== code);
    onChange(next);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="选择项目"
          className="h-auto min-h-10 w-full justify-between gap-2 whitespace-normal px-3 py-2 text-left font-normal"
        >
          <span className="flex flex-1 flex-wrap items-center gap-1.5">
            {selected.length === 0 ? (
              <span className="flex items-center gap-2 text-slate-500">
                <FolderKanban className="size-4" />
                {placeholder}
              </span>
            ) : (
              selected.map((item) => (
                <Badge
                  key={item.code}
                  variant="outline"
                  className="mr-0 border-primary/20 bg-primary/5 text-xs font-normal text-slate-700"
                >
                  {item.name}
                </Badge>
              ))
            )}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-slate-400" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-72 p-0"
      >
        <Command>
          <CommandInput placeholder="搜索项目..." />
          <CommandList>
            <CommandEmpty>无匹配项目</CommandEmpty>
            {PROJECT_CATEGORIES.map((category) => (
              <CommandGroup key={category} heading={category}>
                {PROJECTS[category].map((item) => {
                  const isChecked = value.includes(item.code);
                  return (
                    <CommandItem
                      key={item.code}
                      value={`${item.code} ${item.name}`}
                      onSelect={() => {
                        onChange(
                          isChecked
                            ? value.filter((c: string) => c !== item.code)
                            : [...value, item.code],
                        );
                      }}
                      className="gap-2.5"
                    >
                      <Checkbox
                        checked={isChecked}
                        aria-label={`选择 ${item.name}`}
                        onCheckedChange={(checked) =>
                          toggle(
                            item.code,
                            checked === true,
                          )
                        }
                        className="data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-slate-800">
                          {item.name}
                        </span>
                        <span className="block truncate text-xs text-slate-400">
                          {item.code}
                        </span>
                      </span>
                      {isChecked && (
                        <Check className="size-4 shrink-0 text-primary" />
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export const projectCodeToName = (code: string): string =>
  ALL_PROJECTS.find((item) => item.code === code)?.name ?? '';