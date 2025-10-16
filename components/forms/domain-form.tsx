"use client";

import { Dispatch, SetStateAction, useState, useTransition } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { User } from "@prisma/client";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { DomainFormData } from "@/lib/dto/domains";
import { cn } from "@/lib/utils";
import { createDomainSchema } from "@/lib/validations/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Icons } from "@/components/shared/icons";

import { FormSectionColumns } from "../dashboard/form-section-columns";
import { Badge } from "../ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";
import { Switch } from "../ui/switch";

export type FormData = DomainFormData;

export type FormType = "add" | "edit";

export interface DomainFormProps {
  user: Pick<User, "id" | "name">;
  isShowForm: boolean;
  setShowForm: Dispatch<SetStateAction<boolean>>;
  type: FormType;
  initData?: DomainFormData | null;
  action: string;
  onRefresh: () => void;
}

export function DomainForm({
  setShowForm,
  type,
  initData,
  action,
  onRefresh,
}: DomainFormProps) {
  const t = useTranslations("List");
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isCheckingCf, startCheckCfTransition] = useTransition();
  const [isCheckingResend, startCheckResendTransition] = useTransition();
  const [currentRecordStatus, setCurrentRecordStatus] = useState(
    initData?.enable_dns || false,
  );
  const [currentEmailStatus, setCurrentEmailStatus] = useState(
    initData?.enable_email || false,
  );
  const [currentDnsProvider, setCurrentDnsProvider] = useState(
    initData?.dns_provider_type || "cloudflare",
  );
  const [isCheckedCfConfig, setIsCheckedCfConfig] = useState(false);
  const [isCheckedAliyunConfig, setIsCheckedAliyunConfig] = useState(false);
  const [isCheckedResendConfig, setIsCheckedResendConfig] = useState(false);

  const {
    handleSubmit,
    register,
    formState: { errors },
    getValues,
    setValue,
  } = useForm<FormData>({
    resolver: zodResolver(createDomainSchema),
    defaultValues: {
      id: initData?.id || "",
      domain_name: initData?.domain_name || "",
      enable_short_link: initData?.enable_short_link || false,
      enable_email: initData?.enable_email || false,
      enable_dns: initData?.enable_dns || false,
      dns_provider_type: initData?.dns_provider_type || "cloudflare",
      cf_zone_id: initData?.cf_zone_id || "",
      cf_api_key: initData?.cf_api_key || "",
      cf_email: initData?.cf_email || "",
      cf_record_types: initData?.cf_record_types || "CNAME,A,TXT",
      cf_api_key_encrypted: initData?.cf_api_key_encrypted || false,
      aliyun_access_key_id: initData?.aliyun_access_key_id || "",
      aliyun_access_key_secret: initData?.aliyun_access_key_secret || "",
      aliyun_region: initData?.aliyun_region || "cn-hangzhou",
      aliyun_domain_name: initData?.aliyun_domain_name || "",
      aliyun_record_types: initData?.aliyun_record_types || "A,AAAA,CNAME,MX,TXT,NS,SRV,CAA,PTR",
      resend_api_key: initData?.resend_api_key || "",
      min_url_length: initData?.min_url_length,
      min_email_length: initData?.min_email_length,
      min_record_length: initData?.min_record_length,
      max_short_links: initData?.max_short_links || 0,
      max_email_forwards: initData?.max_email_forwards || 0,
      max_dns_records: initData?.max_dns_records || 0,
      active: initData?.active || true,
    },
  });

  const onSubmit = handleSubmit((data) => {
    if (type === "add") {
      handleCreateDomain(data);
    } else if (type === "edit") {
      handleUpdateDomain(data);
    }
  });

  const handleCreateDomain = async (data: DomainFormData) => {
    startTransition(async () => {
      const response = await fetch(`${action}`, {
        method: "POST",
        body: JSON.stringify({
          data,
        }),
      });
      if (!response.ok || response.status !== 200) {
        toast.error("Created Failed!", {
          description: await response.text(),
        });
      } else {
        // const res = await response.json();
        toast.success(`Created successfully!`);
        setShowForm(false);
        onRefresh();
      }
    });
  };

  const handleUpdateDomain = async (data: DomainFormData) => {
    startTransition(async () => {
      if (type === "edit") {
        const response = await fetch(`${action}`, {
          method: "PUT",
          body: JSON.stringify(data),
        });
        if (!response.ok || response.status !== 200) {
          toast.error("Update Failed", {
            description: await response.text(),
          });
        } else {
          await response.json();
          toast.success(`Update successfully!`);
          setShowForm(false);
          onRefresh();
        }
      }
    });
  };

  const handleDeleteDomain = async () => {
    if (type === "edit") {
      startDeleteTransition(async () => {
        const response = await fetch(`${action}`, {
          method: "DELETE",
          body: JSON.stringify({
            domain_name: initData?.domain_name,
          }),
        });
        if (!response.ok || response.status !== 200) {
          toast.error("Delete Failed", {
            description: await response.text(),
          });
        } else {
          await response.json();
          toast.success(`Success`);
          setShowForm(false);
          onRefresh();
        }
      });
    }
  };

  const handleCfCheckAccess = async (event) => {
    event?.stopPropagation();
    if (!currentRecordStatus) return;

    if (isCheckedCfConfig) {
      setIsCheckedCfConfig(false);
    }

    startCheckCfTransition(async () => {
      const values = getValues(["cf_zone_id", "cf_api_key", "cf_email"]);
      const res = await fetch(
        `/api/domain/check-cf?zone_id=${values[0]}&api_key=${values[1]}&email=${values[2]}`,
      );
      if (res.ok) {
        const data = await res.json();
        if (data === 200) {
          setIsCheckedCfConfig(true);
          return;
        }
      }
      setIsCheckedCfConfig(false);
      toast.error("Access Failed", {
        description: "Please check your Cloudflare settings and try again.",
      });
    });
  };

  const handleAliyunCheckAccess = async (event) => {
    event?.stopPropagation();
    if (!currentRecordStatus) return;

    if (isCheckedAliyunConfig) {
      setIsCheckedAliyunConfig(false);
    }

    startCheckCfTransition(async () => {
      const values = getValues(["aliyun_access_key_id", "aliyun_access_key_secret", "aliyun_domain_name"]);
      console.log("阿里云验证参数:", values);
      
      if (!values[0] || !values[1] || !values[2]) {
        toast.error("请填写完整的阿里云配置信息", {
          description: "Access Key ID、Access Key Secret 和域名名称都是必需的。",
        });
        return;
      }
      
      try {
        const res = await fetch(
          `/api/domain/check-aliyun?access_key_id=${encodeURIComponent(values[0])}&access_key_secret=${encodeURIComponent(values[1])}&domain_name=${encodeURIComponent(values[2])}`,
        );
        
        console.log("阿里云验证响应状态:", res.status);
        
        if (res.ok) {
          const data = await res.json();
          console.log("阿里云验证响应数据:", data);
          
          if (data.success) {
            setIsCheckedAliyunConfig(true);
            toast.success("阿里云 DNS 配置验证成功");
            return;
          } else {
            toast.error(data.message || "阿里云 DNS 配置验证失败", {
              description: "请检查您的阿里云 DNS 配置并重试。",
            });
          }
        } else {
          const errorData = await res.json().catch(() => ({}));
          console.log("阿里云验证错误响应:", errorData);
          toast.error(`验证失败 (${res.status})`, {
            description: errorData.message || "请检查您的阿里云 DNS 配置并重试。",
          });
        }
      } catch (error) {
        console.error("阿里云验证网络错误:", error);
        toast.error("网络错误", {
          description: "无法连接到验证服务，请检查网络连接。",
        });
      }
      
      setIsCheckedAliyunConfig(false);
    });
  };

  const handleResendCheckAccess = async (event) => {
    event?.stopPropagation();
    if (!currentEmailStatus) return;

    if (isCheckedResendConfig) {
      setIsCheckedResendConfig(false);
    }

    startCheckResendTransition(async () => {
      const value = getValues(["resend_api_key", "domain_name"]);
      const res = await fetch(
        `/api/domain/check-resend?api_key=${value[0]}&domain=${value[1]}`,
      );
      if (res.ok) {
        const data = await res.json();
        if (data === 200) {
          setIsCheckedResendConfig(true);
          return;
        }
      } else {
        setIsCheckedResendConfig(false);
        toast.error("Failed to send email", {
          description: await res.text(),
        });
      }
    });
  };

  const ReadyBadge = (
    active: boolean,
    isChecked: boolean,
    isChecking: boolean,
    type: string,
  ) => (
    <Badge
      className={cn(
        "ml-auto text-xs font-semibold",
        !active && "text-muted-foreground",
      )}
      variant={active ? (isChecked ? "green" : "default") : "outline"}
      onClick={(event) =>
        type === "cf"
          ? handleCfCheckAccess(event)
          : handleResendCheckAccess(event)
      }
    >
      {isChecking && <Icons.spinner className="mr-1 size-3 animate-spin" />}
      {isChecked && !isChecking && <Icons.check className="mr-1 size-3" />}
      {isChecked ? t("Verified") : t("Verify Configuration")}
    </Badge>
  );

  return (
    <div>
      <div className="rounded-t-lg bg-muted px-4 py-2 text-lg font-semibold">
        {type === "add" ? t("Create Domain") : t("Edit Domain")}
      </div>
      <form className="p-4" onSubmit={onSubmit}>
        <div className="relative flex flex-col items-center justify-start gap-0 rounded-md bg-neutral-100 p-4 dark:bg-neutral-800">
          <h2 className="absolute left-2 top-2 text-xs font-semibold text-neutral-400">
            {t("Base")}
          </h2>
          <FormSectionColumns title="">
            <div className="flex w-full items-start justify-between gap-2">
              <Label className="mt-2.5 text-nowrap" htmlFor="domain_name">
                {t("Domain Name")}:
              </Label>
              <div className="w-full sm:w-3/5">
                <Input
                  id="target"
                  className="flex-1 bg-neutral-50 shadow-inner"
                  size={32}
                  {...register("domain_name")}
                />
                <div className="flex flex-col justify-between p-1">
                  {errors?.domain_name ? (
                    <p className="pb-0.5 text-[13px] text-red-600">
                      {errors.domain_name.message}
                    </p>
                  ) : (
                    <p className="pb-0.5 text-[13px] text-muted-foreground">
                      {t("Required")}. {t("Example")} example.com
                    </p>
                  )}
                </div>
              </div>
            </div>
          </FormSectionColumns>

          <div className="flex w-full items-center justify-between gap-2">
            <Label className="" htmlFor="active">
              {t("Active")}:
            </Label>
            <Switch
              id="active"
              {...register("active")}
              defaultChecked={initData?.active ?? true}
              onCheckedChange={(value) => setValue("active", value)}
              disabled
            />
          </div>
        </div>

        <div className="relative mt-2 flex flex-col items-center justify-start gap-4 rounded-md bg-neutral-100 p-4 pt-10 dark:bg-neutral-800">
          <h2 className="absolute left-2 top-2 text-xs font-semibold text-neutral-400">
            {t("Services")} ({t("Optional")})
          </h2>

          <div className="flex w-full items-center justify-between gap-2">
            <Label className="" htmlFor="short_url_service">
              {t("Shorten Service")}:
            </Label>
            <Switch
              id="short_url_service"
              {...register("enable_short_link")}
              defaultChecked={initData?.enable_short_link ?? false}
              onCheckedChange={(value) => setValue("enable_short_link", value)}
            />
          </div>

          <div className="flex w-full items-center justify-between gap-2">
            <Label className="" htmlFor="email_service">
              {t("Email Service")}:
            </Label>
            <Switch
              id="email_service"
              {...register("enable_email")}
              defaultChecked={initData?.enable_email ?? false}
              onCheckedChange={(value) => {
                setValue("enable_email", value);
                setCurrentEmailStatus(value);
              }}
            />
          </div>

          <div className="flex w-full items-center justify-between gap-2">
            <Label className="cursor-pointer" htmlFor="dns_record_service">
              {t("Subdomain Service")}:
            </Label>
            <Switch
              id="dns_record_service"
              {...register("enable_dns")}
              defaultChecked={initData?.enable_dns ?? false}
              onCheckedChange={(value) => {
                setValue("enable_dns", value);
                setCurrentRecordStatus(value);
              }}
            />
          </div>
        </div>

        <Collapsible className="relative mt-2 rounded-md bg-neutral-100 p-4 dark:bg-neutral-800">
          <CollapsibleTrigger className="flex w-full items-center justify-between">
            <h2 className="absolute left-2 top-5 flex gap-2 text-xs font-semibold text-neutral-400">
              {t("DNS Provider Configs")} ({t("Optional")})
              {currentDnsProvider === "cloudflare" ? (
                <Icons.cloudflare className="mx-0.5 size-4" />
              ) : (
                <span className="mx-0.5 text-xs">☁️</span>
              )}
            </h2>
            {ReadyBadge(
              currentRecordStatus,
              currentDnsProvider === "cloudflare" ? isCheckedCfConfig : isCheckedAliyunConfig,
              isCheckingCf,
              currentDnsProvider,
            )}
            <Icons.chevronDown className="ml-2 size-4" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            {!currentRecordStatus && (
              <div className="mt-3 flex items-center gap-1 rounded bg-neutral-200 p-2 text-xs dark:bg-neutral-700">
                <Icons.help className="size-3" />{" "}
                {t("Associate with 'Subdomain Service' status")}
              </div>
            )}
            
            {/* DNS 提供商选择 */}
            <FormSectionColumns title="">
              <div className="flex w-full items-start justify-between gap-2">
                <Label className="mt-2.5 text-nowrap" htmlFor="dns_provider">
                  {t("DNS Provider")}:
                </Label>
                <div className="w-full sm:w-3/5">
                  <select
                    id="dns_provider"
                    className="flex-1 rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm shadow-inner dark:border-neutral-600 dark:bg-neutral-700"
                    {...register("dns_provider_type")}
                    value={currentDnsProvider}
                    onChange={(e) => {
                      setValue("dns_provider_type", e.target.value);
                      setCurrentDnsProvider(e.target.value);
                    }}
                    disabled={!currentRecordStatus}
                  >
                    <option value="cloudflare">Cloudflare</option>
                    <option value="aliyun">阿里云 DNS</option>
                  </select>
                  <div className="flex flex-col justify-between p-1">
                    <p className="pb-0.5 text-[13px] text-muted-foreground">
                      选择要使用的 DNS 服务提供商
                    </p>
                  </div>
                </div>
              </div>
            </FormSectionColumns>
            {/* Cloudflare 配置 */}
            {currentDnsProvider === "cloudflare" && (
              <>
                <FormSectionColumns title="">
                  <div className="flex w-full items-start justify-between gap-2">
                    <Label className="mt-2.5 text-nowrap" htmlFor="zone_id">
                      {"Zone ID"}:
                    </Label>
                <div className="w-full sm:w-3/5">
                  <Input
                    id="target"
                    className="flex-1 bg-neutral-50 shadow-inner"
                    size={32}
                    {...register("cf_zone_id")}
                    disabled={!currentRecordStatus}
                  />
                  <div className="flex flex-col justify-between p-1">
                    {errors?.cf_zone_id ? (
                      <p className="pb-0.5 text-[13px] text-red-600">
                        {errors.cf_zone_id.message}
                      </p>
                    ) : (
                      <p className="pb-0.5 text-[13px] text-muted-foreground">
                        {t("Optional")}.{" "}
                        <Link
                          className="text-blue-500"
                          href="/docs/developer/cloudflare"
                          target="_blank"
                        >
                          {t("How to get zone id?")}
                        </Link>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </FormSectionColumns>
            <FormSectionColumns title="">
              <div className="flex w-full items-start justify-between gap-2">
                <Label className="mt-2.5 text-nowrap" htmlFor="api-key">
                  {t("API Key")}:
                </Label>
                <div className="w-full sm:w-3/5">
                  <Input
                    id="target"
                    className="flex-1 bg-neutral-50 shadow-inner"
                    size={32}
                    {...register("cf_api_key")}
                    disabled={!currentRecordStatus}
                  />
                  <div className="flex flex-col justify-between p-1">
                    {errors?.cf_api_key ? (
                      <p className="pb-0.5 text-[13px] text-red-600">
                        {errors.cf_api_key.message}
                      </p>
                    ) : (
                      <p className="pb-0.5 text-[13px] text-muted-foreground">
                        {t("Optional")}.{" "}
                        <Link
                          className="text-blue-500"
                          href="/docs/developer/cloudflare"
                          target="_blank"
                        >
                          {t("How to get api key?")}
                        </Link>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </FormSectionColumns>
            <FormSectionColumns title="">
              <div className="flex w-full items-start justify-between gap-2">
                <Label className="mt-2.5 text-nowrap" htmlFor="email">
                  {t("Account Email")}:
                </Label>
                <div className="w-full sm:w-3/5">
                  <Input
                    id="target"
                    className="flex-1 bg-neutral-50 shadow-inner"
                    size={32}
                    {...register("cf_email")}
                    disabled={!currentRecordStatus}
                  />
                  <div className="flex flex-col justify-between p-1">
                    {errors?.cf_email ? (
                      <p className="pb-0.5 text-[13px] text-red-600">
                        {errors.cf_email.message}
                      </p>
                    ) : (
                      <p className="pb-0.5 text-[13px] text-muted-foreground">
                        {t("Optional")}.{" "}
                        <Link
                          className="text-blue-500"
                          href="/docs/developer/cloudflare"
                          target="_blank"
                        >
                          {t("How to get cloudflare account email?")}
                        </Link>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </FormSectionColumns>
            <FormSectionColumns title="">
              <div className="flex w-full items-start justify-between gap-2">
                <Label className="mt-2.5 text-nowrap" htmlFor="record-types">
                  {t("Record Types")}:
                </Label>
                <div className="w-full sm:w-3/5">
                  <Input
                    id="record-types"
                    className="flex-1 bg-neutral-50 shadow-inner"
                    size={32}
                    {...register("cf_record_types")}
                    disabled={!currentRecordStatus}
                  />
                  <div className="flex flex-col justify-between p-1">
                    {errors?.cf_record_types ? (
                      <p className="pb-0.5 text-[13px] text-red-600">
                        {errors.cf_record_types.message}
                      </p>
                    ) : (
                      <p className="pb-0.5 text-[13px] text-muted-foreground">
                        {t("Required")}. {t("Allowed record types")},{" "}
                        {t("use `,` to separate")}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </FormSectionColumns>
              </>
            )}

            {/* 阿里云 DNS 配置 */}
            {currentDnsProvider === "aliyun" && (
              <>
                <FormSectionColumns title="">
                  <div className="flex w-full items-start justify-between gap-2">
                    <Label className="mt-2.5 text-nowrap" htmlFor="aliyun_access_key_id">
                      {t("Access Key ID")}:
                    </Label>
                    <div className="w-full sm:w-3/5">
                      <Input
                        id="aliyun_access_key_id"
                        className="flex-1 bg-neutral-50 shadow-inner"
                        size={32}
                        {...register("aliyun_access_key_id")}
                        disabled={!currentRecordStatus}
                      />
                      <div className="flex flex-col justify-between p-1">
                        {errors?.aliyun_access_key_id ? (
                          <p className="pb-0.5 text-[13px] text-red-600">
                            {errors.aliyun_access_key_id.message}
                          </p>
                        ) : (
                          <p className="pb-0.5 text-[13px] text-muted-foreground">
                            {t("Required")}. 阿里云 AccessKey ID
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </FormSectionColumns>
                
                <FormSectionColumns title="">
                  <div className="flex w-full items-start justify-between gap-2">
                    <Label className="mt-2.5 text-nowrap" htmlFor="aliyun_access_key_secret">
                      {t("Access Key Secret")}:
                    </Label>
                    <div className="w-full sm:w-3/5">
                      <Input
                        id="aliyun_access_key_secret"
                        type="password"
                        className="flex-1 bg-neutral-50 shadow-inner"
                        size={32}
                        {...register("aliyun_access_key_secret")}
                        disabled={!currentRecordStatus}
                      />
                      <div className="flex flex-col justify-between p-1">
                        {errors?.aliyun_access_key_secret ? (
                          <p className="pb-0.5 text-[13px] text-red-600">
                            {errors.aliyun_access_key_secret.message}
                          </p>
                        ) : (
                          <p className="pb-0.5 text-[13px] text-muted-foreground">
                            {t("Required")}. 阿里云 AccessKey Secret
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </FormSectionColumns>

                <FormSectionColumns title="">
                  <div className="flex w-full items-start justify-between gap-2">
                    <Label className="mt-2.5 text-nowrap" htmlFor="aliyun_region">
                      {t("Region")}:
                    </Label>
                    <div className="w-full sm:w-3/5">
                      <Input
                        id="aliyun_region"
                        className="flex-1 bg-neutral-50 shadow-inner"
                        size={32}
                        {...register("aliyun_region")}
                        disabled={!currentRecordStatus}
                      />
                      <div className="flex flex-col justify-between p-1">
                        <p className="pb-0.5 text-[13px] text-muted-foreground">
                          {t("Optional")}. 阿里云区域，默认为 cn-hangzhou
                        </p>
                      </div>
                    </div>
                  </div>
                </FormSectionColumns>

                <FormSectionColumns title="">
                  <div className="flex w-full items-start justify-between gap-2">
                    <Label className="mt-2.5 text-nowrap" htmlFor="aliyun_domain_name">
                      {t("Domain Name")}:
                    </Label>
                    <div className="w-full sm:w-3/5">
                      <Input
                        id="aliyun_domain_name"
                        className="flex-1 bg-neutral-50 shadow-inner"
                        size={32}
                        {...register("aliyun_domain_name")}
                        disabled={!currentRecordStatus}
                      />
                      <div className="flex flex-col justify-between p-1">
                        {errors?.aliyun_domain_name ? (
                          <p className="pb-0.5 text-[13px] text-red-600">
                            {errors.aliyun_domain_name.message}
                          </p>
                        ) : (
                          <p className="pb-0.5 text-[13px] text-muted-foreground">
                            {t("Required")}. 要在阿里云 DNS 中管理的域名
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </FormSectionColumns>

                <FormSectionColumns title="">
                  <div className="flex w-full items-start justify-between gap-2">
                    <Label className="mt-2.5 text-nowrap" htmlFor="aliyun_record_types">
                      {t("Record Types")}:
                    </Label>
                    <div className="w-full sm:w-3/5">
                      <Input
                        id="aliyun_record_types"
                        className="flex-1 bg-neutral-50 shadow-inner"
                        size={32}
                        {...register("aliyun_record_types")}
                        disabled={!currentRecordStatus}
                        placeholder="A,AAAA,CNAME,MX,TXT,NS,SRV,CAA,PTR"
                      />
                      <div className="flex flex-col justify-between p-1">
                        <p className="pb-0.5 text-[13px] text-muted-foreground">
                          {t("Required")}. 阿里云 DNS 支持的记录类型，用逗号分隔
                        </p>
                        <p className="pb-0.5 text-[12px] text-blue-600">
                          支持: A, AAAA, CNAME, MX, TXT, NS, SRV, CAA, PTR, ALIAS
                        </p>
                      </div>
                    </div>
                  </div>
                </FormSectionColumns>
              </>
            )}

            {/* 配置验证按钮 */}
            {currentRecordStatus && (
              <div className="mt-4 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={currentDnsProvider === "cloudflare" ? handleCfCheckAccess : handleAliyunCheckAccess}
                  disabled={isCheckingCf}
                  className="flex items-center gap-2"
                >
                  {isCheckingCf ? (
                    <Icons.spinner className="size-4 animate-spin" />
                  ) : (
                    <Icons.check className="size-4" />
                  )}
                  {currentDnsProvider === "cloudflare" ? "验证 Cloudflare 配置" : "验证阿里云配置"}
                </Button>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>

        <Collapsible className="relative mt-2 rounded-md bg-neutral-100 p-4 dark:bg-neutral-800">
          <CollapsibleTrigger className="flex w-full items-center justify-between">
            <h2 className="absolute left-2 top-5 flex gap-2 text-xs font-semibold text-neutral-400">
              {t("Resend Configs")} ({t("Optional")})
              <Icons.resend className="mx-0.5 size-4" />
            </h2>
            {ReadyBadge(
              currentEmailStatus,
              isCheckedResendConfig,
              isCheckingResend,
              "resend",
            )}
            <Icons.chevronDown className="ml-2 size-4" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            {!currentEmailStatus && (
              <div className="mt-3 flex items-center gap-1 rounded bg-neutral-200 p-2 text-xs dark:bg-neutral-700">
                <Icons.help className="size-3" />{" "}
                {t("Associate with 'Email Service' status")}
              </div>
            )}
            <FormSectionColumns title="">
              <div className="flex w-full items-start justify-between gap-2">
                <Label className="mt-2.5 text-nowrap" htmlFor="zone_id">
                  {t("API Key")} ({t("send email service")}):
                </Label>
                <div className="w-full sm:w-3/5">
                  <Input
                    id="target"
                    className="flex-1 bg-neutral-50 shadow-inner"
                    size={32}
                    {...register("resend_api_key")}
                    disabled={!currentEmailStatus}
                  />
                  <div className="flex flex-col justify-between p-1">
                    {errors?.resend_api_key ? (
                      <p className="pb-0.5 text-[13px] text-red-600">
                        {errors.resend_api_key.message}
                      </p>
                    ) : (
                      <p className="pb-0.5 text-[13px] text-muted-foreground">
                        {t("Optional")}.{" "}
                        <Link
                          className="text-blue-500"
                          href="/docs/developer/email"
                          target="_blank"
                        >
                          {t("How to get resend api key?")}
                        </Link>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </FormSectionColumns>
          </CollapsibleContent>
        </Collapsible>

        <Collapsible className="relative mt-2 rounded-md bg-neutral-100 p-4 dark:bg-neutral-800">
          <CollapsibleTrigger className="flex w-full items-center justify-between">
            <h2 className="absolute left-2 top-4 flex gap-2 text-xs font-semibold text-neutral-400">
              {t("Limit Configs")} ({t("Optional")})
            </h2>
            <Icons.chevronDown className="ml-auto size-4" />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-2">
            <div className="flex w-full items-center justify-between gap-2">
              <Label className="cursor-pointer" htmlFor="min_url_length">
                {t("Min URL Length")}:
              </Label>
              <Input
                id="target"
                className="max-w-20 flex-1 bg-neutral-50 shadow-inner"
                size={32}
                type="number"
                defaultValue={initData?.min_url_length ?? 3}
                {...register("min_url_length", {
                  valueAsNumber: true,
                })}
              />
            </div>

            <div className="flex w-full items-center justify-between gap-2">
              <Label className="cursor-pointer" htmlFor="min_email_length">
                {t("Min Email Length")}:
              </Label>
              <Input
                id="target"
                className="max-w-20 flex-1 bg-neutral-50 shadow-inner"
                size={32}
                type="number"
                defaultValue={initData?.min_email_length ?? 3}
                {...register("min_email_length", {
                  valueAsNumber: true,
                })}
              />
            </div>

            <div className="flex w-full items-center justify-between gap-2">
              <Label className="cursor-pointer" htmlFor="min_subdomain_length">
                {t("Min Subdomain Length")}:
              </Label>
              <Input
                id="target"
                className="max-w-20 flex-1 bg-neutral-50 shadow-inner"
                size={32}
                type="number"
                defaultValue={initData?.min_record_length ?? 3}
                {...register("min_record_length", {
                  valueAsNumber: true,
                })}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Action buttons */}
        <div className="mt-3 flex justify-end gap-3">
          {type === "edit" && (
            <Button
              type="button"
              variant="destructive"
              className="mr-auto w-[80px] px-0"
              onClick={() => handleDeleteDomain()}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Icons.spinner className="size-4 animate-spin" />
              ) : (
                <p>{t("Delete")}</p>
              )}
            </Button>
          )}
          <Button
            type="reset"
            variant="outline"
            className="w-[80px] px-0"
            onClick={() => setShowForm(false)}
          >
            {t("Cancel")}
          </Button>
          <Button
            type="submit"
            variant="blue"
            disabled={isPending}
            className="w-[80px] shrink-0 px-0"
          >
            {isPending ? (
              <Icons.spinner className="size-4 animate-spin" />
            ) : (
              <p>{type === "edit" ? t("Update") : t("Save")}</p>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
