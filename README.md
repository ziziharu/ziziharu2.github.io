# 南あわじ市 体操会場マッピングシステム MVP

庁内職員向けに、南あわじ市内の体操会場、徒歩5分圏（300m）、徒歩10分圏（600m）、バス停を地図上で確認する静的Webアプリです。

## 起動方法

一番簡単な方法は、プロジェクト直下の `start-server.bat` をダブルクリックする方法です。

`start.server.bat` でも同じように起動できます。

起動するとブラウザで以下が開きます。

```text
http://localhost:8000
```

終了するときは、開いた黒い画面で `Ctrl + C` を押してください。

PowerShellから起動する場合は、プロジェクト直下で以下を実行します。

```powershell
.\start-server.ps1
```

Pythonは不要です。

手動で起動する場合は、このフォルダで簡易Webサーバーを起動します。

```powershell
.\start-server.ps1
```

その後、ブラウザで以下を開きます。

```text
http://localhost:8000
```

`index.html` を直接開くと、ブラウザの制限でCSVファイルを読み込めない場合があります。必ず `http://localhost:8000` のURLで開いてください。

## 地図や会場情報が表示されないとき

- `file:///.../index.html` で開いていないか確認してください。正しくは `http://localhost:8000` です。
- サーバー起動時の画面を閉じるとアプリも止まります。画面は開いたままにしてください。
- 8000番ポートが他のアプリで使われている場合は、別のポートで起動してください。例: `$env:PORT = "8010"` の後に `.\start-server.ps1`、URLは `http://localhost:8010` です。
- 背景地図の国土地理院タイルはインターネット接続が必要です。庁内ネットワークで外部地図タイルがブロックされる場合、背景地図は表示されません。ただし、Leaflet本体は `public/vendor/leaflet/` にローカル配置済みです。

## ファイル構成

```text
public/
  index.html
  vendor/
    leaflet/
      leaflet.css
      leaflet.js
  css/
    style.css
  js/
    app.js
  data/
    venues.csv
    venue_files.csv
    bus_stops.csv
  files/
    venues/
      001/
        sample.png
        sample.pdf
start-server.bat
start.server.bat
start-server.ps1
```

## データファイルの編集方法

初期MVPではDBを使わず、`public/data/` 配下のCSVを編集します。

- 体操会場を追加・修正する場合: `public/data/venues.csv`
- 会場資料を追加・修正する場合: `public/data/venue_files.csv`
- バス停を追加・修正する場合: `public/data/bus_stops.csv`

CSVはExcelで編集できます。保存形式はCSVのままで、文字コードはできればUTF-8にしてください。

項目の中にカンマを入れる場合は、その項目をダブルクォートで囲んでください。

```csv
1,中央公民館,"駐車場あり, 入口は南側",true
```

## 会場データの項目説明

`venues.csv`

| 項目 | 内容 |
| --- | --- |
| `id` | 会場ID。変更しない固定番号として扱います。 |
| `name` | 会場名 |
| `address` | 住所 |
| `district` | 地区名。地区フィルタに使います。 |
| `latitude` | 緯度 |
| `longitude` | 経度 |
| `day_of_week` | 開催曜日 |
| `time_text` | 開催時間。終了時間は独立項目にせず、自由入力文字列で管理します。 |
| `frequency` | 開催頻度 |
| `notes` | 備考 |
| `is_active` | `true` の場合だけ地図に表示します。 |

## 会場資料データの項目説明

`venue_files.csv`

| 項目 | 内容 |
| --- | --- |
| `id` | ファイルID |
| `venue_id` | 紐づく会場ID |
| `title` | 資料名 |
| `file_type` | `png` または `pdf` |
| `file_path` | `public/` から見たファイルパス |
| `description` | 説明文 |
| `display_order` | 表示順 |

PNGは詳細パネル内でプレビュー表示されます。PDFは別タブで開くリンクとして表示されます。

## バス停データの項目説明

`bus_stops.csv`

| 項目 | 内容 |
| --- | --- |
| `id` | バス停ID |
| `name` | バス停名 |
| `latitude` | 緯度 |
| `longitude` | 経度 |
| `route_name` | 路線名 |
| `notes` | 備考 |
| `is_active` | `true` の場合だけ地図に表示します。 |

## ファイル配置ルール

会場資料は `public/files/venues/{会場ID}/` に置きます。

例:

```text
public/files/venues/001/entrance.png
public/files/venues/001/parking.pdf
```

`venue_files.csv` の `file_path` には、`public/` から見た相対パスを書きます。

```csv
2,1,駐車場案内,pdf,files/venues/001/parking.pdf,駐車場の案内図,2
```

## 今後の拡張候補

- Excel入力ファイルからCSVへの変換
- 住民向けの住所検索
- 入力住所から緯度経度への変換
- 300m以内・600m以内の会場検索
- 最寄り会場・最寄りバス停の表示
- PostgreSQL + PostGISへの移行
- 人口メッシュ・高齢者人口分布の重ね合わせ
- 道路ネットワークに沿った徒歩圏表示
- 地図のPDFまたは画像出力
