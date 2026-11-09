import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronsUpDown, Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import { taskPoolApi } from '@/api';
import {
  PROJECTS,
  PROJECT_CATEGORIES,
} from '@shared/projects';
import type { TaskSource } from '@shared/api.interface';

const SEPARATOR = '、';

const splitNames = (value: string): string[] =>
  value
    ? value
        .split(SEPARATOR)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    : [];

interface SelectOption {
  value: string;
  label: string;
  hint?: string;
}

interface SelectGroup {
  heading: string;
  options: SelectOption[];
}

interface StringMultiSelectProps {
  value: string[];
  onChange: (values: string[]) => void;
  options: SelectOption[];
  groups?: SelectGroup[];
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  triggerLabel: string;
}

const StringMultiSelect: React.FC<StringMultiSelectProps> = ({
  value,
  onChange,
  options,
  groups,
  placeholder,
  searchPlaceholder,
  emptyText,
  triggerLabel,
}) => {
  const [open, setOpen] = useState(false);
  const allOptions = groups && groups.length > 0
    ? groups.flatMap((g: SelectGroup) => g.options)
    : options;
  const matched = allOptions.filter((o: SelectOption) => value.includes(o.value));
  const unmatched = value
    .filter((v: string) => !allOptions.some((o: SelectOption) => o.value === v))
    .map((v: string): SelectOption => ({ value: v, label: v }));
  const selected = [...matched, ...unmatched];

  const toggle = (optValue: string, checked: boolean): void => {
    onChange(
      checked
        ? [...value, optValue]
        : value.filter((v: string) => v !== optValue),
    );
  };

  const renderOption = (o: SelectOption) => {
    const isChecked = value.includes(o.value);
    return (
      <CommandItem
        key={o.value}
        value={`${o.label}${o.hint ? ` ${o.hint}` : ''}`}
        onSelect={() =>
          onChange(
            isChecked
              ? value.filter((v: string) => v !== o.value)
              : [...value, o.value],
          )
        }
        className="gap-2.5"
      >
        <Checkbox
          checked={isChecked}
          aria-label={`选择 ${o.label}`}
          onCheckedChange={(c) => toggle(o.value, c === true)}
          className="data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-slate-800">
            {o.label}
          </span>
          {o.hint && (
            <span className="block truncate text-xs text-slate-400">
              {o.hint}
            </span>
          )}
        </span>
        {isChecked && (
          <Check className="size-4 shrink-0 text-primary" />
        )}
      </CommandItem>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={triggerLabel}
          className="h-auto min-h-10 w-full justify-between gap-2 whitespace-normal px-3 py-2 text-left font-normal"
        >
          <span className="flex flex-1 flex-wrap items-center gap-1.5">
            {selected.length === 0 ? (
              <span className="text-slate-500">{placeholder}</span>
            ) : (
              selected.map((o) => (
                <Badge
                  key={o.value}
                  variant="outline"
                  className="border-primary/20 bg-primary/5 text-xs font-normal text-slate-700"
                >
                  {o.label}
                </Badge>
              ))
            )}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-slate-400" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            {groups && groups.length > 0
              ? groups.map((group) => (
                  <CommandGroup key={group.heading} heading={group.heading}>
                    {group.options.map((o) => renderOption(o))}
                  </CommandGroup>
                ))
              : (
                  <CommandGroup>{options.map((o) => renderOption(o))}</CommandGroup>
                )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

const MineTaskMultiSelect: React.FC<{
  value: string;
  onChange: (value: string) => void;
}> = ({ value, onChange }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['task-pool', 'mine'],
    queryFn: () => taskPoolApi.getMyTaskPool(),
  });
  if (isLoading) {
    return <Input disabled value={value} placeholder="加载任务中..." />;
  }
  const items = data?.items ?? [];
  return (
    <StringMultiSelect
      value={splitNames(value)}
      onChange={(vals: string[]) => onChange(vals.join(SEPARATOR))}
      options={items.map((t) => ({ value: t.title, label: t.title }))}
      placeholder="从我的任务中选择（可多选）"
      searchPlaceholder="搜索我的任务..."
      emptyText={
        items.length === 0
          ? '暂无任务，请联系室主任在任务池中预置'
          : '无匹配任务'
      }
      triggerLabel="选择我的任务"
    />
  );
};

const ProjectTaskMultiSelect: React.FC<{
  value: string;
  onChange: (value: string) => void;
}> = ({ value, onChange }) => {
  return (
    <StringMultiSelect
      value={splitNames(value)}
      onChange={(vals: string[]) => onChange(vals.join(SEPARATOR))}
      groups={PROJECT_CATEGORIES.map((category) => ({
        heading: category,
        options: PROJECTS[category].map((p) => ({
          value: p.name,
          label: p.name,
          hint: p.code,
        })),
      }))}
      options={[]}
      placeholder="从项目中选择任务名称（可多选）"
      searchPlaceholder="搜索项目名称或编号..."
      emptyText="无匹配项目"
      triggerLabel="从项目中选择任务名称"
    />
  );
};

interface TaskNameFieldProps {
  value: string;
  onChange: (value: string) => void;
  taskSource: TaskSource;
}

export const TaskNameField: React.FC<TaskNameFieldProps> = ({
  value,
  onChange,
  taskSource,
}) => {
  if (taskSource === '飞书任务') {
    return <MineTaskMultiSelect value={value} onChange={onChange} />;
  }
  if (taskSource === '项目任务') {
    return <ProjectTaskMultiSelect value={value} onChange={onChange} />;
  }
  return (
    <Input
      value={value}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
        onChange(e.target.value)
      }
      placeholder="请输入任务名称"
    />
  );
};