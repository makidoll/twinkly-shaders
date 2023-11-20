# Twinkly Shaders

Shaders for my Twinkly fairy lights

Currently set to look similar to my wallpaper

https://gitlab.gnome.org/GNOME/gnome-backgrounds/-/blob/main/backgrounds/blobs-d.svg

## Usage

Update IP address near bottom of `main.ts`

`deno run -A --unstable main.ts` or `pm2 start ecosystem.config.js`

## Home Assistant

```yaml
switch:
    - platform: rest
      name: Maki's Twinkly Lights
      icon: string-lights
      resource: http://192.168.1.10:12345/api/active
      state_resource: http://192.168.1.10:12345/api/active
      method: post # cant use get for state
      body_on: '{"active":true}'
      body_off: '{"active":false}'
      is_on_template: "{{value_json.active}}"
      headers:
          Content-Type: application/json
```
