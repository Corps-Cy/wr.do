"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { User } from "@prisma/client";
import { PenLine, RefreshCw, Trash2, Search, Filter, ArrowUpDown, CheckSquare, Square } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import useSWR, { useSWRConfig } from "swr";

import { UserRecordFormData } from "@/lib/dto/cloudflare-dns-record";
import { TTL_ENUMS } from "@/lib/enums";
import { fetcher } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FormType, RecordForm } from "@/components/forms/record-form";
import { EmptyPlaceholder } from "@/components/shared/empty-placeholder";
import { Icons } from "@/components/shared/icons";
import { LinkInfoPreviewer } from "@/components/shared/link-previewer";
import { PaginationWrapper } from "@/components/shared/pagination";
import { TimeAgoIntl } from "@/components/shared/time-ago";

export interface RecordListProps {
  user: Pick<User, "id" | "name" | "apiKey" | "email" | "role">;
  action: string;
}

function TableColumnSekleton() {
  return (
    <TableRow className="grid grid-cols-4 items-center sm:grid-cols-10">
      <TableCell className="col-span-1 flex justify-center">
        <Skeleton className="h-4 w-4" />
      </TableCell>
      <TableCell className="col-span-1">
        <Skeleton className="h-5 w-16" />
      </TableCell>
      <TableCell className="col-span-1">
        <Skeleton className="h-5 w-24" />
      </TableCell>
      <TableCell className="col-span-1 hidden sm:inline-block">
        <Skeleton className="h-5 w-24" />
      </TableCell>
      <TableCell className="col-span-1 hidden sm:inline-block">
        <Skeleton className="h-5 w-16" />
      </TableCell>
      <TableCell className="col-span-1 hidden justify-center sm:flex">
        <Skeleton className="h-5 w-16" />
      </TableCell>
      <TableCell className="col-span-1 hidden justify-center sm:flex">
        <Skeleton className="h-5 w-20" />
      </TableCell>
      <TableCell className="col-span-1 hidden justify-center sm:flex">
        <Skeleton className="h-5 w-16" />
      </TableCell>
      <TableCell className="col-span-1 flex justify-center">
        <Skeleton className="h-5 w-16" />
      </TableCell>
    </TableRow>
  );
}

// 根据DNS记录类型和域名构造正确的URL
function constructDNSRecordURL(record: UserRecordFormData): string {
  const { type, name, zone_name } = record;
  
  // 对于某些记录类型，不需要构造HTTP URL
  const nonHttpTypes = ['TXT', 'MX', 'NS', 'SRV', 'CAA', 'PTR'];
  if (nonHttpTypes.includes(type)) {
    return `https://${zone_name}`;
  }
  
  // 对于可以访问的记录类型（A, AAAA, CNAME），构造完整的子域名URL
  if (type === 'A' || type === 'AAAA' || type === 'CNAME') {
    // 如果name已经包含域名，直接使用
    if (name.includes('.')) {
      return `https://${name}`;
    }
    // 否则拼接子域名和主域名
    return `https://${name}.${zone_name}`;
  }
  
  // 默认情况
  return `https://${zone_name}`;
}

export default function UserRecordsList({ user, action }: RecordListProps) {
  const { isMobile } = useMediaQuery();
  const [isShowForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<FormType>("add");
  const [currentEditRecord, setCurrentEditRecord] =
    useState<UserRecordFormData | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isSyncing, setIsSyncing] = useState(false);
  const [deletingRecord, setDeletingRecord] = useState<string | null>(null);
  
  // 批量操作状态
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [bulkOperation, setBulkOperation] = useState<string>("");
  
  // 搜索和过滤状态
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterDomain, setFilterDomain] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("modified_on");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  
  const isAdmin = action.includes("/admin");

  const t = useTranslations("List");

  const { mutate } = useSWRConfig();

  const { data, isLoading } = useSWR<{
    total: number;
    list: UserRecordFormData[];
  }>(`${action}?page=${currentPage}&size=${pageSize}`, fetcher, {
    revalidateOnFocus: false,
  });

  // 过滤和排序记录
  const filteredAndSortedRecords = useMemo(() => {
    if (!data?.list) return [];

    let filtered = data.list.filter((record: UserRecordFormData) => {
      // 搜索过滤
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        if (!record.name.toLowerCase().includes(searchLower) &&
            !record.type.toLowerCase().includes(searchLower) &&
            !record.content.toLowerCase().includes(searchLower) &&
            !record.zone_name.toLowerCase().includes(searchLower)) {
          return false;
        }
      }

      // 类型过滤
      if (filterType !== "all" && record.type !== filterType) {
        return false;
      }

      // 状态过滤
      if (filterStatus !== "all") {
        const status = filterStatus === "active" ? 1 : 
                      filterStatus === "inactive" ? 0 : 
                      filterStatus === "pending" ? 2 : 3;
        if (record.active !== status) {
          return false;
        }
      }

      // 域名过滤
      if (filterDomain !== "all" && record.zone_name !== filterDomain) {
        return false;
      }

      return true;
    });

    // 排序
    filtered.sort((a: UserRecordFormData, b: UserRecordFormData) => {
      let aValue: any = a[sortBy as keyof UserRecordFormData];
      let bValue: any = b[sortBy as keyof UserRecordFormData];

      // 处理日期类型
      if (sortBy === "created_on" || sortBy === "modified_on") {
        aValue = new Date(aValue || 0).getTime();
        bValue = new Date(bValue || 0).getTime();
      }

      // 处理字符串类型
      if (typeof aValue === "string") {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (sortOrder === "asc") {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [data?.list, searchTerm, filterType, filterStatus, filterDomain, sortBy, sortOrder]);

  const handleRefresh = () => {
    console.log("[刷新调试] 开始刷新列表，URL:", `${action}?page=${currentPage}&size=${pageSize}`);
    mutate(`${action}?page=${currentPage}&size=${pageSize}`, undefined, { revalidate: true });
    console.log("[刷新调试] 刷新命令已发送");
  };

  const handleSyncDNS = async () => {
    if (isSyncing) return; // 防止重复点击
    
    setIsSyncing(true);
    try {
      toast.loading("正在同步DNS记录...", { id: "sync-dns" });
      
      console.log("[同步调试] 开始同步所有DNS记录");
      
      const response = await fetch('/api/record/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}), // 不传递任何参数，让后端同步所有域名
      });

      console.log("[同步调试] 同步响应状态:", response.status);

      if (response.ok) {
        const result = await response.json();
        console.log("[同步调试] 同步结果:", result);
        
        if (result.errors && result.errors.length > 0) {
          console.warn("[同步调试] 同步过程中有错误:", result.errors);
          toast.warning(`同步完成但有警告：${result.errors.join(', ')}`, { id: "sync-dns" });
        } else {
          toast.success(`同步完成！成功: ${result.synced} 条，跳过: ${result.skipped} 条`, { id: "sync-dns" });
        }
      } else {
        const errorText = await response.text();
        console.error("[同步调试] 同步失败:", errorText);
        toast.error(`同步失败: ${errorText}`, { id: "sync-dns" });
      }
      
      // 同步完成后刷新列表
      handleRefresh();
    } catch (error) {
      console.error('同步DNS记录失败:', error);
      toast.error("同步失败，请稍后重试", { id: "sync-dns" });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteRecord = async (record: UserRecordFormData) => {
    setDeletingRecord(record.record_id);
    try {
      toast.loading("正在删除记录...", { id: `delete-${record.record_id}` });
      
      const response = await fetch('/api/record/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          record_id: record.record_id,
          zone_id: record.zone_id,
          active: record.active
        }),
      });

      if (response.ok) {
        toast.success(`记录 "${record.name}" 已删除`, { id: `delete-${record.record_id}` });
        handleRefresh();
      } else {
        const errorText = await response.text();
        toast.error(`删除失败: ${errorText}`, { id: `delete-${record.record_id}` });
      }
    } catch (error) {
      console.error('删除记录失败:', error);
      toast.error("删除失败，请稍后重试", { id: `delete-${record.record_id}` });
    } finally {
      setDeletingRecord(null);
    }
  };

  const handleChangeStatu = async (
    checked: boolean,
    record: UserRecordFormData,
    setChecked: (value: boolean) => void,
  ) => {
    const originalState = record.active === 1;
    setChecked(checked);

    toast.loading(`${checked ? '激活' : '停用'}记录中...`, { id: `status-${record.record_id}` });

    try {
      const res = await fetch(`/api/record/update`, {
        method: "PUT",
        body: JSON.stringify({
          zone_id: record.zone_id,
          record_id: record.record_id,
          active: checked ? 1 : 0,
          target: record.name,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data === "Target is accessible!") {
          if (originalState) {
            setChecked(originalState);
          }
          toast.success(`记录 "${record.name}" 状态已更新: ${data}`, { id: `status-${record.record_id}` });
        } else {
          setChecked(originalState);
          toast.warning(`记录 "${record.name}" 状态更新警告: ${data}`, { id: `status-${record.record_id}` });
        }
      } else {
        setChecked(originalState);
        const errorText = await res.text();
        toast.error(`状态更新失败: ${errorText}`, { id: `status-${record.record_id}` });
      }
    } catch (error) {
      setChecked(originalState);
      console.error('状态更新失败:', error);
      toast.error("状态更新失败，请稍后重试", { id: `status-${record.record_id}` });
    }
  };

  // 批量操作函数
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allRecordIds = new Set(filteredAndSortedRecords.map(record => record.record_id));
      setSelectedRecords(allRecordIds);
      setSelectAll(true);
    } else {
      setSelectedRecords(new Set());
      setSelectAll(false);
    }
  };

  const handleSelectRecord = (recordId: string, checked: boolean) => {
    const newSelected = new Set(selectedRecords);
    if (checked) {
      newSelected.add(recordId);
    } else {
      newSelected.delete(recordId);
    }
    setSelectedRecords(newSelected);
    setSelectAll(newSelected.size === filteredAndSortedRecords.length);
  };

  const handleBulkDelete = async () => {
    if (selectedRecords.size === 0) return;

    const confirmed = confirm(`确定要删除选中的 ${selectedRecords.size} 条记录吗？`);
    if (!confirmed) return;

    let successCount = 0;
    let failCount = 0;

    for (const recordId of selectedRecords) {
      try {
        const record = filteredAndSortedRecords.find(r => r.record_id === recordId);
        if (record) {
          await handleDeleteRecord(record);
          successCount++;
        }
      } catch (error) {
        console.error(`删除记录 ${recordId} 失败:`, error);
        failCount++;
      }
    }

    toast.success(`批量删除完成！成功: ${successCount} 条，失败: ${failCount} 条`);
    setSelectedRecords(new Set());
    setSelectAll(false);
    handleRefresh();
  };

  const handleBulkToggleStatus = async (activate: boolean) => {
    if (selectedRecords.size === 0) return;

    const action = activate ? "激活" : "停用";
    const confirmed = confirm(`确定要${action}选中的 ${selectedRecords.size} 条记录吗？`);
    if (!confirmed) return;

    let successCount = 0;
    let failCount = 0;

    for (const recordId of selectedRecords) {
      try {
        const record = filteredAndSortedRecords.find(r => r.record_id === recordId);
        if (record) {
          const response = await fetch("/api/record/update", {
            method: "PUT",
            body: JSON.stringify({
              zone_id: record.zone_id,
              record_id: record.record_id,
              active: activate ? 1 : 0,
              target: record.name,
            }),
          });

          if (response.ok) {
            successCount++;
          } else {
            failCount++;
          }
        }
      } catch (error) {
        console.error(`${action}记录 ${recordId} 失败:`, error);
        failCount++;
      }
    }

    toast.success(`批量${action}完成！成功: ${successCount} 条，失败: ${failCount} 条`);
    setSelectedRecords(new Set());
    setSelectAll(false);
    handleRefresh();
  };

  // 获取唯一域名列表用于过滤
  const uniqueDomains = useMemo(() => {
    if (!data?.list) return [];
    const domains = [...new Set(data.list.map(record => record.zone_name))];
    return domains.sort();
  }, [data?.list]);

  return (
    <>
      <Card className="xl:col-span-2">
        <CardHeader className="flex flex-row items-center">
          {isAdmin ? (
            <CardDescription className="text-balance text-lg font-bold">
              <span>{t("Total Subdomains")}:</span>{" "}
              <span className="font-bold">{data && data.total}</span>
            </CardDescription>
          ) : (
            <div className="grid gap-2">
              <CardTitle>{t("Subdomain List")}</CardTitle>
              <CardDescription className="hidden text-balance sm:block">
                {t("Before using please read the")}{" "}
                <Link
                  target="_blank"
                  className="font-semibold text-yellow-600 after:content-['↗'] hover:underline"
                  href="/docs/dns-records#legitimacy-review"
                >
                  {t("legitimacy review")}
                </Link>
                . {t("See")}{" "}
                <Link
                  target="_blank"
                  className="text-blue-500 hover:underline"
                  href="/docs/examples/vercel"
                >
                  {t("examples")}
                </Link>{" "}
                {t("for more usage")}.
              </CardDescription>
            </div>
          )}
          <div className="ml-auto flex items-center justify-end gap-3">
            <Button
              variant={"outline"}
              onClick={handleSyncDNS}
              disabled={isSyncing}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">
                {isSyncing ? '同步中...' : '同步DNS'}
              </span>
            </Button>
            <Button
              variant={"outline"}
              onClick={() => handleRefresh()}
              disabled={isLoading}
            >
              {isLoading ? (
                <Icons.refreshCw className="size-4 animate-spin" />
              ) : (
                <Icons.refreshCw className="size-4" />
              )}
            </Button>
            <Button
              className="flex shrink-0 gap-1"
              variant="default"
              onClick={() => {
                setCurrentEditRecord(null);
                setShowForm(false);
                setFormType("add");
                setShowForm(!isShowForm);
              }}
            >
              <Icons.add className="size-4" />
              <span className="hidden sm:inline">{t("Add Record")}</span>
            </Button>
          </div>
        </CardHeader>
        
        {/* 搜索和过滤界面 */}
        <div className="border-b px-6 py-4">
          <div className="flex flex-col gap-4">
            {/* 搜索栏 */}
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="搜索记录名称、类型、内容或域名..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchTerm("");
                  setFilterType("all");
                  setFilterStatus("all");
                  setFilterDomain("all");
                }}
              >
                <Filter className="h-4 w-4 mr-2" />
                重置
              </Button>
            </div>

            {/* 过滤选项 */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">类型:</span>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="A">A</SelectItem>
                    <SelectItem value="AAAA">AAAA</SelectItem>
                    <SelectItem value="CNAME">CNAME</SelectItem>
                    <SelectItem value="MX">MX</SelectItem>
                    <SelectItem value="TXT">TXT</SelectItem>
                    <SelectItem value="NS">NS</SelectItem>
                    <SelectItem value="SRV">SRV</SelectItem>
                    <SelectItem value="CAA">CAA</SelectItem>
                    <SelectItem value="PTR">PTR</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">状态:</span>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="active">激活</SelectItem>
                    <SelectItem value="inactive">停用</SelectItem>
                    <SelectItem value="pending">待审核</SelectItem>
                    <SelectItem value="rejected">已拒绝</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">域名:</span>
                <Select value={filterDomain} onValueChange={setFilterDomain}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    {uniqueDomains.map(domain => (
                      <SelectItem key={domain} value={domain}>{domain}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">排序:</span>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="modified_on">修改时间</SelectItem>
                    <SelectItem value="created_on">创建时间</SelectItem>
                    <SelectItem value="name">名称</SelectItem>
                    <SelectItem value="type">类型</SelectItem>
                    <SelectItem value="zone_name">域名</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                >
                  <ArrowUpDown className={`h-4 w-4 ${sortOrder === "asc" ? "rotate-180" : ""}`} />
                </Button>
              </div>
            </div>

            {/* 批量操作栏 */}
            {selectedRecords.size > 0 && (
              <div className="flex items-center justify-between rounded-lg bg-blue-50 p-3 dark:bg-blue-950">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    已选择 {selectedRecords.size} 条记录
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkToggleStatus(true)}
                  >
                    批量激活
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkToggleStatus(false)}
                  >
                    批量停用
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleBulkDelete}
                  >
                    批量删除
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <CardContent>
          <Table>
            <TableHeader className="bg-gray-100/50 dark:bg-primary-foreground">
              <TableRow className="grid grid-cols-4 items-center sm:grid-cols-10">
                <TableHead className="col-span-1 flex items-center justify-center">
                  <Checkbox
                    checked={selectAll}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead className="col-span-1 flex items-center font-bold">
                  {t("Type")}
                </TableHead>
                <TableHead className="col-span-1 flex items-center font-bold">
                  {t("Name")}
                </TableHead>
                <TableHead className="col-span-2 hidden items-center font-bold sm:flex">
                  {t("Content")}
                </TableHead>
                <TableHead className="col-span-1 hidden items-center font-bold sm:flex">
                  {t("TTL")}
                </TableHead>
                <TableHead className="col-span-1 hidden items-center justify-center font-bold sm:flex">
                  {t("Status")}
                </TableHead>
                <TableHead className="col-span-1 hidden items-center font-bold sm:flex">
                  {t("User")}
                </TableHead>
                <TableHead className="col-span-1 hidden items-center justify-center font-bold sm:flex">
                  {t("Updated")}
                </TableHead>
                <TableHead className="col-span-1 flex items-center justify-center font-bold">
                  {t("Actions")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <>
                  <TableColumnSekleton />
                  <TableColumnSekleton />
                  <TableColumnSekleton />
                  <TableColumnSekleton />
                  <TableColumnSekleton />
                </>
              ) : filteredAndSortedRecords.length > 0 ? (
                filteredAndSortedRecords.map((record) => (
                  <TableRow
                    key={record.id}
                    className="grid animate-fade-in grid-cols-4 items-center animate-in sm:grid-cols-10"
                  >
                    <TableCell className="col-span-1 flex items-center justify-center">
                      <Checkbox
                        checked={selectedRecords.has(record.record_id)}
                        onCheckedChange={(checked) => 
                          handleSelectRecord(record.record_id, checked as boolean)
                        }
                      />
                    </TableCell>
                    <TableCell className="col-span-1">
                      <Badge className="text-xs" variant="outline">
                        {record.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="col-span-1">
                      {[0, 1].includes(record.active) ? (
                        <LinkInfoPreviewer
                          apiKey={user.apiKey ?? ""}
                          url={constructDNSRecordURL(record)}
                          formatUrl={record.name}
                        />
                      ) : (
                        record.name
                      )}
                    </TableCell>
                    <TableCell className="col-span-2 hidden truncate text-nowrap sm:inline-block">
                      <TooltipProvider>
                        <Tooltip delayDuration={200}>
                          <TooltipTrigger className="truncate">
                            {record.content}
                          </TooltipTrigger>
                          <TooltipContent>{record.content}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell className="col-span-1 hidden sm:inline-block">
                      {
                        TTL_ENUMS.find((ttl) => ttl.value === `${record.ttl}`)
                          ?.label
                      }
                    </TableCell>
                    <TableCell className="col-span-1 hidden items-center justify-center gap-1 sm:flex">
                      {[0, 1].includes(record.active) && (
                        <SwitchWrapper
                          record={record}
                          onChangeStatu={handleChangeStatu}
                        />
                      )}
                      {record.active === 2 && (
                        <Badge
                          className="text-nowrap rounded-md"
                          variant={"yellow"}
                        >
                          {t("Pending")}
                        </Badge>
                      )}
                      {record.active === 3 && (
                        <Badge
                          className="text-nowrap rounded-md"
                          variant={"outline"}
                        >
                          {t("Rejected")}
                        </Badge>
                      )}

                      {![1, 3].includes(record.active) && (
                        <TooltipProvider>
                          <Tooltip delayDuration={200}>
                            <TooltipTrigger className="truncate">
                              <Icons.help className="size-4 cursor-pointer text-yellow-500 opacity-90" />
                            </TooltipTrigger>
                            <TooltipContent>
                              {record.active === 0 && (
                                <ul className="list-disc px-3">
                                  <li>
                                    {t("The target is currently inaccessible")}.
                                  </li>
                                  <li>
                                    {t("Please check the target and try again")}
                                    .
                                  </li>
                                  <li>
                                    {t(
                                      "If the target is not activated within 3 days",
                                    )}
                                    , <br />
                                    {t("the administrator will")}{" "}
                                    <strong className="text-red-500">
                                      {t("delete this record")}
                                    </strong>
                                    .
                                  </li>
                                </ul>
                              )}
                              {record.active === 2 && (
                                <ul className="list-disc px-3">
                                  <li>
                                    {t(
                                      "The record is currently pending for admin approval",
                                    )}
                                    .
                                  </li>
                                </ul>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </TableCell>
                    <TableCell className="col-span-1 hidden truncate sm:flex">
                      <TooltipProvider>
                        <Tooltip delayDuration={200}>
                          <TooltipTrigger className="truncate">
                            {record.user.name ?? record.user.email}
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{record.user.name}</p>
                            <p>{record.user.email}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell className="col-span-1 hidden justify-center sm:flex">
                      <TimeAgoIntl
                        date={record.modified_on as unknown as Date}
                      />
                    </TableCell>
                    <TableCell className="col-span-1 flex justify-center gap-1">
                      {record.active === 3 ? (
                        <Button
                          className="h-7 text-nowrap px-1 text-xs sm:px-1.5"
                          size="sm"
                          variant={"outline"}
                          onClick={() => {
                            setCurrentEditRecord(record);
                            setShowForm(false);
                            setFormType("edit");
                            setShowForm(!isShowForm);
                          }}
                        >
                          <p className="hidden text-nowrap sm:block">
                            {t("Reject")}
                          </p>
                          <Icons.close className="mx-0.5 size-4 sm:ml-1 sm:size-3" />
                        </Button>
                      ) : [0, 1].includes(record.active) ? (
                        <>
                          <Button
                            className="h-7 text-nowrap px-1 text-xs hover:bg-slate-100 dark:hover:text-primary-foreground sm:px-1.5"
                            size="sm"
                            variant={"outline"}
                            onClick={() => {
                              setCurrentEditRecord(record);
                              setShowForm(false);
                              setFormType("edit");
                              setShowForm(!isShowForm);
                            }}
                          >
                            <p className="hidden text-nowrap sm:block">
                              {t("Edit")}
                            </p>
                            <PenLine className="mx-0.5 size-4 sm:ml-1 sm:size-3" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                className="h-7 text-nowrap px-1 text-xs hover:bg-red-100 dark:hover:bg-red-900 sm:px-1.5"
                                size="sm"
                                variant={"outline"}
                                disabled={deletingRecord === record.record_id}
                              >
                                <Trash2 className="mx-0.5 size-4 sm:ml-1 sm:size-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>确认删除</AlertDialogTitle>
                                <AlertDialogDescription>
                                  您确定要删除记录 <strong>{record.name}</strong> ({record.type}) 吗？
                                  <br />
                                  此操作不可撤销。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>取消</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteRecord(record)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  删除
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      ) : record.active === 2 &&
                        user.role === "ADMIN" &&
                        isAdmin ? (
                        <Button
                          className="h-7 text-nowrap px-1 text-xs hover:bg-blue-400 dark:hover:text-primary-foreground sm:px-1.5"
                          size="sm"
                          variant={"blue"}
                          onClick={() => {
                            setCurrentEditRecord(record);
                            setShowForm(false);
                            setFormType("edit");
                            setShowForm(!isShowForm);
                          }}
                        >
                          <p className="hidden text-nowrap sm:block">
                            {t("Review")}
                          </p>
                          <Icons.eye className="mx-0.5 size-4 sm:ml-1 sm:size-3" />
                        </Button>
                      ) : (
                        "--"
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center">
                    <EmptyPlaceholder className="shadow-none">
                      <EmptyPlaceholder.Icon name="globe" />
                      <EmptyPlaceholder.Title>
                        {t("No Subdomains")}
                      </EmptyPlaceholder.Title>
                      <EmptyPlaceholder.Description>
                        You don&apos;t have any subdomain yet. Start creating
                        record.
                      </EmptyPlaceholder.Description>
                    </EmptyPlaceholder>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {data && Math.ceil(data.total / pageSize) > 1 && (
            <PaginationWrapper
              layout={isMobile ? "right" : "split"}
              total={data.total}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              pageSize={pageSize}
              setPageSize={setPageSize}
            />
          )}
        </CardContent>
      </Card>

      <Modal
        className="md:max-w-2xl"
        showModal={isShowForm}
        setShowModal={setShowForm}
      >
        <RecordForm
          user={{ id: user.id, name: user.name || "", email: user.email || "" }}
          isShowForm={isShowForm}
          setShowForm={setShowForm}
          type={formType}
          initData={currentEditRecord}
          action={action}
          onRefresh={handleRefresh}
        />
      </Modal>
    </>
  );
}

const SwitchWrapper = ({
  record,
  onChangeStatu,
}: {
  record: UserRecordFormData;
  onChangeStatu: (
    checked: boolean,
    record: UserRecordFormData,
    setChecked: (value: boolean) => void,
  ) => Promise<void>;
}) => {
  const [checked, setChecked] = useState(record.active === 1);

  return (
    <Switch
      checked={checked}
      onCheckedChange={(value) => onChangeStatu(value, record, setChecked)}
    />
  );
};
