{{- define "pos-validation-sdk.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "pos-validation-sdk.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{- define "pos-validation-sdk.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "pos-validation-sdk.labels" -}}
helm.sh/chart: {{ include "pos-validation-sdk.chart" . }}
app.kubernetes.io/name: {{ include "pos-validation-sdk.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{- define "pos-validation-sdk.selectorLabels" -}}
app.kubernetes.io/name: {{ include "pos-validation-sdk.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "pos-validation-sdk.redisHost" -}}
{{- if .Values.redis.enabled -}}
{{- printf "%s-redis" (include "pos-validation-sdk.fullname" .) -}}
{{- else -}}
{{- default "redis" .Values.redis.host -}}
{{- end -}}
{{- end -}}
