{{/*
Expand the name of the chart.
*/}}
{{- define "bitebase.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "bitebase.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart label value (name-version).
*/}}
{{- define "bitebase.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels applied to every resource.
*/}}
{{- define "bitebase.labels" -}}
helm.sh/chart: {{ include "bitebase.chart" . }}
{{ include "bitebase.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels — used in Deployment.spec.selector and Service.spec.selector.
*/}}
{{- define "bitebase.selectorLabels" -}}
app.kubernetes.io/name: {{ include "bitebase.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Service account name.
*/}}
{{- define "bitebase.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "bitebase.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Docker image reference (repo:tag). Falls back to Chart.appVersion.
*/}}
{{- define "bitebase.image" -}}
{{- printf "%s:%s" .Values.image.repository (default .Chart.AppVersion .Values.image.tag) }}
{{- end }}

{{/*
Migration image — falls back to the main app image.
*/}}
{{- define "bitebase.migrationsImage" -}}
{{- $repo := default .Values.image.repository .Values.migrations.image.repository }}
{{- $tag  := default (default .Chart.AppVersion .Values.image.tag) .Values.migrations.image.tag }}
{{- printf "%s:%s" $repo $tag }}
{{- end }}

{{/*
Name of the Secret that holds sensitive env vars.
Uses existingSecret if set, otherwise the chart-managed secret.
*/}}
{{- define "bitebase.secretName" -}}
{{- if .Values.existingSecret }}
{{- .Values.existingSecret }}
{{- else }}
{{- include "bitebase.fullname" . }}
{{- end }}
{{- end }}

{{/*
Name of the bundled PostgreSQL service (from bitnami subchart).
*/}}
{{- define "bitebase.postgresql.fullname" -}}
{{- printf "%s-postgresql" .Release.Name | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Computed DATABASE_URL when using the bundled postgresql subchart.
*/}}
{{- define "bitebase.postgresql.url" -}}
{{- printf "postgresql://%s:%s@%s:5432/%s"
    .Values.postgresql.auth.username
    .Values.postgresql.auth.password
    (include "bitebase.postgresql.fullname" .)
    .Values.postgresql.auth.database }}
{{- end }}
